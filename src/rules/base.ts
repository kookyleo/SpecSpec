// src/rules/base.ts

import type { Rule, Engine, ExecutionContext, Issue, Descriptor } from '../types.js';

/**
 * Helper to find the underlying issues array for any context shape.
 */
export function getIssueArray(context: ExecutionContext): Issue[] | null {
  if ('issues' in context && Array.isArray(context.issues)) {
    return context.issues;
  }
  if ('packageContext' in context && 'issues' in context.packageContext) {
    return context.packageContext.issues;
  }
  if ('fileContext' in context && 'packageContext' in context.fileContext) {
    return context.fileContext.packageContext.issues;
  }
  return null;
}

/**
 * Base class for negation rules.
 * Passes if the inner rule fails, fails if the inner rule passes.
 */
abstract class NegationRule implements Rule {
  constructor(protected readonly innerRule: Rule) {}

  protected abstract getFailureCode(): string;
  protected abstract getFailureMessage(): string;

  execute(engine: Engine, context: ExecutionContext): void {
    const issues = getIssueArray(context);
    if (!issues) {
      this.innerRule.execute(engine, context);
      return;
    }

    const initialIssueCount = issues.length;
    this.innerRule.execute(engine, context);
    const newIssues = issues.splice(initialIssueCount);

    if (newIssues.length === 0) {
      context.addIssue(this.getFailureCode(), this.getFailureMessage());
    }
  }
}

/**
 * IsNotRule - Negation for Is* rules.
 * Usage: $.IsNot.Empty(), $.IsNot.JSON()
 */
export class IsNotRule extends NegationRule {
  protected getFailureCode(): string {
    return 'is.not.fail';
  }

  protected getFailureMessage(): string {
    return `Expected to NOT match: ${this.innerRule.constructor.name}`;
  }
}

/**
 * DoesNotRule - Negation for Contains rules.
 * Usage: $.DoesNot.Contain(File({ path: 'debug.log' }))
 */
export class DoesNotRule extends NegationRule {
  constructor(
    innerRule: Rule,
    private readonly descriptor: Descriptor
  ) {
    super(innerRule);
  }

  protected getFailureCode(): string {
    return 'does.not.contain.fail';
  }

  protected getFailureMessage(): string {
    return `Expected to NOT contain: ${this.descriptor.constructor.name}`;
  }
}
