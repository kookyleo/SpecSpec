// test/helpers.ts
// Test utilities

import { ValidationContext, type Context, type Issue } from '../dist/context.js';

export function createTestContext(value: unknown = null): Context & { issues: Issue[] } {
  return new ValidationContext([], value);
}
