// SpecSpec/src/assertions/base.mjs
// Base assertion classes and logic operators

export class Assertion {
  execute(engine, context) {
    throw new Error(`Assertion '${this.constructor.name}' must implement 'execute'.`);
  }
}

// Helper to find the underlying issues array for any context shape
export function getIssueArray(context) {
  if (context && Array.isArray(context.issues)) return context.issues;
  if (context && context.packageContext && Array.isArray(context.packageContext.issues)) {
    return context.packageContext.issues;
  }
  if (context && context.fileContext && context.fileContext.packageContext &&
      Array.isArray(context.fileContext.packageContext.issues)) {
    return context.fileContext.packageContext.issues;
  }
  return null;
}

export class NotAssertion extends Assertion {
  constructor(assertion) {
    super();
    this.assertion = assertion;
  }

  execute(engine, context) {
    const issues = getIssueArray(context);
    if (!issues) {
      // Fallback: if we cannot track issues precisely, just run the assertion
      this.assertion.execute(engine, context);
      return;
    }
    const initialIssueCount = issues.length;
    this.assertion.execute(engine, context);
    const newIssues = issues.splice(initialIssueCount);
    if (newIssues.length === 0) {
      context.addIssue('logic.not.fail',
        `Assertion violated: ${this.assertion.constructor.name} was expected to fail but passed.`);
    }
  }
}

export class SpecAssertion extends Assertion {
  constructor(name, rules) {
    super();
    this.name = name;
    this.rules = rules;
  }

  execute(engine, context) {
    for (const assertion of this.rules) {
      assertion.execute(engine, context);
    }
  }
}

export class PackageAssertion extends Assertion {
  constructor(opts) {
    super();
    this.opts = opts;
  }

  execute(engine, context) {
    const specFunc = this.opts && this.opts.withSpec;
    if (specFunc && typeof specFunc === 'function') {
      const spec = specFunc();
      if (spec && typeof spec.execute === 'function') {
        spec.execute(engine, context);
      }
    }
  }
}
