// SpecSpec/src/engine.mjs
// The generic, domain-agnostic validation engine.

import fs from 'node:fs';
import vm from 'node:vm';
import { TargetExecutionContext } from './contexts/index.mjs';

export class ValidationEngine {
  constructor() {
    this.ruleFactories = {};
    this.contextStack = [];

    const handler = {
      get: (target, prop) => {
        // Access DSL methods like $.Is, $.Has
        if (prop in this.ruleFactories.$) {
          return this.ruleFactories.$[prop];
        }
        // Access context properties like $.path
        const currentContext = this.contextStack[this.contextStack.length - 1];
        if (currentContext && prop in currentContext) {
          const value = currentContext[prop];
          return typeof value === 'function' ? value.bind(currentContext) : value;
        }
        // Global DSL factories for descriptors and top-level containers
        if (prop in this.ruleFactories && typeof this.ruleFactories[prop] === 'function') {
          return this.ruleFactories[prop];
        }
      }
    };
    this.proxy$ = new Proxy({}, handler);
    this.sandboxContext = vm.createContext({ $: this.proxy$, console: console });
  }

  registerRules(factories) {
    Object.assign(this.sandboxContext, factories);
    // Store DSL categories for the proxy handler
    if (factories.$) {
      this.ruleFactories.$ = factories.$;
    }
    // Store other top-level factories like Directory(), File(), ZipFile(), Spec()
    for (const key of ['Directory', 'File', 'ZipFile', 'Spec']) {
      if (factories[key]) {
        this.ruleFactories[key] = factories[key];
      }
    }
  }

  run(specPath, targetPath) {
    const specCode = fs.readFileSync(specPath, 'utf8');
    let rootAssertion = null;

    // Root selection rule:
    // The first descriptor written at the top level becomes the root.
    const originalFactories = {};
    for (const key of Object.keys(this.sandboxContext)) {
      if (key === '$' || key === 'Spec') continue;
      const fn = this.sandboxContext[key];
      if (typeof fn !== 'function') continue;
      originalFactories[key] = fn;
      this.sandboxContext[key] = (...args) => {
        const assertion = fn(...args);
        if (this.contextStack.length === 0 && !rootAssertion && assertion && typeof assertion.execute === 'function') {
          rootAssertion = assertion;
        }
        return assertion;
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
        issues: [{
          level: 'error',
          code: 'spec.crash',
          message: `Spec file has a syntax error: ${err.message}`
        }]
      };
    }

    for (const [key, fn] of Object.entries(originalFactories)) {
      this.sandboxContext[key] = fn;
    }

    if (!rootAssertion) {
      return {
        ok: false,
        issues: [{
          level: 'error',
          code: 'spec.empty',
          message: 'Spec file did not define a root assertion (e.g., Package({...})).'
        }]
      };
    }

    const targetContext = new TargetExecutionContext(targetPath);

    try {
      this.executeInContext(targetContext, () => {
        rootAssertion.execute(this, targetContext);
      });
    } catch (err) {
      targetContext.addIssue('executor.crash', `The validator crashed: ${err.message}`, { stack: err.stack });
    }

    return { ok: targetContext.issues.length === 0, issues: targetContext.issues };
  }

  // Execute a function within the VM sandbox with '$' bound to the provided context.
  executeInContext(context, func) {
    this.contextStack.push(context);
    this.sandboxContext._tempFunc = func;
    this.proxy$.currentContext = context;

    const result = vm.runInNewContext('_tempFunc()', this.sandboxContext);

    delete this.sandboxContext._tempFunc;
    this.contextStack.pop();
    this.proxy$.currentContext = this.contextStack[this.contextStack.length - 1] || null;

    return result;
  }
}
