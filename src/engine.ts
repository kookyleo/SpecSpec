// src/engine.ts
// The generic, domain-agnostic validation engine.

import fs from 'node:fs';
import vm from 'node:vm';
import type {
  Engine,
  Descriptor,
  Validator,
  ExecutionContext,
  ValidationResult,
  DescriptorConstructor,
} from './types.js';
import { TargetExecutionContext } from './contexts/index.js';

interface RuleFactories {
  $?: Record<string, unknown>;
  [key: string]: unknown;
}

interface SandboxContext extends vm.Context {
  $: Record<string, unknown>;
  console: Console;
  _tempFunc?: () => unknown;
  [key: string]: unknown;
}

// Type guard for Descriptor
function isDescriptor(obj: unknown): obj is Descriptor {
  return obj !== null && typeof obj === 'object' && 'opts' in obj;
}

export class ValidationEngine implements Engine {
  public readonly ruleFactories: RuleFactories = {};
  private readonly validators = new Map<DescriptorConstructor, Validator>();
  private readonly contextStack: ExecutionContext[] = [];
  private readonly proxy$: Record<string, unknown>;
  private readonly sandboxContext: SandboxContext;

  constructor() {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get: (_target, prop: string) => {
        // Access DSL methods like $.Is, $.Has
        const dollarFactories = this.ruleFactories['$'];
        if (dollarFactories && prop in dollarFactories) {
          return (dollarFactories as Record<string, unknown>)[prop];
        }
        // Access context properties like $.path
        const currentContext = this.contextStack[this.contextStack.length - 1];
        if (currentContext && prop in currentContext) {
          const value = (currentContext as unknown as Record<string, unknown>)[prop];
          return typeof value === 'function' ? value.bind(currentContext) : value;
        }
        // Global DSL factories for descriptors and top-level containers
        const factory = this.ruleFactories[prop];
        if (factory !== undefined && typeof factory === 'function') {
          return factory;
        }
        return undefined;
      },
    };
    this.proxy$ = new Proxy({}, handler);
    this.sandboxContext = vm.createContext({
      $: this.proxy$,
      console,
    }) as SandboxContext;
  }

  registerValidator<D extends Descriptor>(
    descriptorClass: DescriptorConstructor<D>,
    validator: Validator<D>
  ): void {
    this.validators.set(descriptorClass, validator as Validator);
  }

  getValidator<D extends Descriptor>(descriptor: D): Validator<D> | undefined {
    return this.validators.get(descriptor.constructor as DescriptorConstructor) as Validator<D> | undefined;
  }

  registerRules(factories: Record<string, unknown>): void {
    Object.assign(this.sandboxContext, factories);
    // Store DSL categories for the proxy handler
    const dollarSign = factories['$'];
    if (dollarSign) {
      this.ruleFactories['$'] = dollarSign as Record<string, unknown>;
    }
    // Store other top-level factories like Directory(), File(), Spec(), Package()
    for (const key of ['Directory', 'File', 'Spec', 'Package']) {
      const factory = factories[key];
      if (factory !== undefined) {
        this.ruleFactories[key] = factory;
      }
    }
  }

  run(specPath: string, targetPath: string): ValidationResult {
    const specCode = fs.readFileSync(specPath, 'utf8');
    let root: Descriptor | null = null;

    // Root selection rule:
    // The first Descriptor written at the top level becomes the root.
    const originalFactories: Record<string, (...args: unknown[]) => unknown> = {};
    for (const key of Object.keys(this.sandboxContext)) {
      if (key === '$' || key === 'Spec' || key === 'console') continue;
      const fn = this.sandboxContext[key];
      if (typeof fn !== 'function') continue;
      originalFactories[key] = fn as (...args: unknown[]) => unknown;
      this.sandboxContext[key] = (...args: unknown[]) => {
        const factory = originalFactories[key];
        if (!factory) return undefined;
        const result = factory(...args);
        if (this.contextStack.length === 0 && !root) {
          if (isDescriptor(result)) {
            root = result;
          }
        }
        return result;
      };
    }

    try {
      vm.runInNewContext(specCode, this.sandboxContext, { filename: specPath });
    } catch (err) {
      for (const [key, fn] of Object.entries(originalFactories)) {
        this.sandboxContext[key] = fn;
      }
      return {
        ok: false,
        issues: [
          {
            level: 'error',
            code: 'spec.crash',
            message: `Spec file has a syntax error: ${(err as Error).message}`,
          },
        ],
      };
    }

    for (const [key, fn] of Object.entries(originalFactories)) {
      this.sandboxContext[key] = fn;
    }

    if (!root) {
      return {
        ok: false,
        issues: [
          {
            level: 'error',
            code: 'spec.empty',
            message: 'Spec file did not define a root (e.g., Package({...})).',
          },
        ],
      };
    }

    const targetContext = new TargetExecutionContext(targetPath);
    const rootDescriptor: Descriptor = root;

    try {
      this.executeInContext(targetContext, () => {
        const validator = this.getValidator(rootDescriptor);
        if (validator) {
          validator.validate(rootDescriptor, this, targetContext);
        } else {
          targetContext.addIssue(
            'validator.missing',
            `No validator found for: ${rootDescriptor.constructor.name}`
          );
        }
      });
    } catch (err) {
      targetContext.addIssue('executor.crash', `The validator crashed: ${(err as Error).message}`);
    }

    return { ok: targetContext.issues.length === 0, issues: targetContext.issues };
  }

  // Execute a function within the VM sandbox with '$' bound to the provided context.
  executeInContext<T>(context: ExecutionContext, func: () => T): T {
    this.contextStack.push(context);
    this.sandboxContext['_tempFunc'] = func;
    this.proxy$['currentContext'] = context;

    const result = vm.runInNewContext('_tempFunc()', this.sandboxContext) as T;

    delete this.sandboxContext['_tempFunc'];
    this.contextStack.pop();
    this.proxy$['currentContext'] = this.contextStack[this.contextStack.length - 1] ?? null;

    return result;
  }
}
