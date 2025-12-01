// src/engine.ts
// SpecEngine - VM sandbox for running spec files

import fs from 'node:fs';
import vm from 'node:vm';
import { ValidationContext, type Issue } from './context.js';
import { Type, Modifier, isType, isModifier } from './base.js';

// Import all built-in types and modifiers
import * as primitives from './types/primitives.js';
import * as structural from './types/structural.js';
import * as modifiers from './modifiers/index.js';

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
}

export interface EngineOptions {
  /** Custom types to register */
  types?: Record<string, unknown>;
}

/**
 * SpecEngine - loads and runs spec files in a VM sandbox
 *
 * @example
 * const engine = new SpecEngine();
 * engine.register({ MyType: ... });
 * const result = engine.run('my.spec.js', '/path/to/target');
 */
export class SpecEngine {
  private readonly globals: Record<string, unknown> = {};

  constructor(options?: EngineOptions) {
    // Register built-in primitives
    this.register({
      Str: primitives.Str,
      Bool: primitives.Bool,
      Num: primitives.Num,
    });

    // Register built-in structural types
    this.register({
      Field: structural.Field,
      File: structural.File,
      Directory: structural.Directory,
      JsonFile: structural.JsonFile,
    });

    // Register built-in modifiers
    this.register({
      OneOf: modifiers.OneOf,
      ListOf: modifiers.ListOf,
    });

    // Register custom types
    if (options?.types) {
      this.register(options.types);
    }
  }

  /**
   * Register types/modifiers to be available in spec files
   */
  register(types: Record<string, unknown>): void {
    Object.assign(this.globals, types);
  }

  /**
   * Run a spec file against a target path
   */
  run(specPath: string, targetPath: string): ValidationResult {
    const specCode = fs.readFileSync(specPath, 'utf-8');
    let rootType: Type | Modifier | null = null;

    // Create sandbox context with all globals
    // The last top-level expression that produces a Type/Modifier becomes root
    const sandbox = this.createSandbox((result) => {
      rootType = result;
    });

    // Run spec file in sandbox
    try {
      vm.runInContext(specCode, sandbox, { filename: specPath });
    } catch (err) {
      return {
        ok: false,
        issues: [{
          level: 'error',
          code: 'spec.syntax_error',
          message: `Spec file error: ${(err as Error).message}`,
          path: [],
        }],
      };
    }

    // Check root type was defined
    if (!rootType) {
      return {
        ok: false,
        issues: [{
          level: 'error',
          code: 'spec.no_root',
          message: 'Spec file must define a root type (e.g., Directory({ ... }))',
          path: [],
        }],
      };
    }

    // Validate target
    const ctx = new ValidationContext([], targetPath);
    // TypeScript narrowing doesn't work well across closures, use assertion
    const root = rootType as Type | Modifier;

    try {
      root.validate(targetPath, ctx);
    } catch (err) {
      ctx.addIssue('engine.error', `Validation error: ${(err as Error).message}`);
    }

    return {
      ok: ctx.issues.filter(i => i.level === 'error').length === 0,
      issues: ctx.issues,
    };
  }

  /**
   * Parse a spec file and return the root type (for documentation generation)
   */
  parseSpec(specPath: string): Type | Modifier | null {
    const specCode = fs.readFileSync(specPath, 'utf-8');
    let rootType: Type | Modifier | null = null;

    const sandbox = this.createSandbox((result) => {
      rootType = result;
    });

    try {
      vm.runInContext(specCode, sandbox, { filename: specPath });
    } catch {
      return null;
    }

    return rootType;
  }

  /**
   * Create a VM sandbox with all registered globals
   */
  private createSandbox(onRoot: (root: Type | Modifier) => void): vm.Context {
    const wrappedGlobals: Record<string, unknown> = {};

    // Wrap each global to capture root
    for (const [name, value] of Object.entries(this.globals)) {
      if (typeof value === 'function') {
        wrappedGlobals[name] = (...args: unknown[]) => {
          const result = (value as (...args: unknown[]) => unknown)(...args);
          if (isType(result) || isModifier(result)) {
            onRoot(result);
          }
          return result;
        };
        // Copy static properties (like _default)
        Object.assign(wrappedGlobals[name] as object, value);
      } else {
        wrappedGlobals[name] = value;
      }
    }

    return vm.createContext({
      ...wrappedGlobals,
      console, // Allow console for debugging
    });
  }
}

/**
 * Create a new SpecEngine with default configuration
 */
export function createEngine(options?: EngineOptions): SpecEngine {
  return new SpecEngine(options);
}
