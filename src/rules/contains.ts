// src/rules/contains.ts

import type { Rule, Engine, ExecutionContext, Descriptor } from '../types.js';

/**
 * ContainsRule - Validates that the context contains a structure
 * described by the given descriptor.
 *
 * Delegates to the appropriate Validator for the descriptor type.
 */
export class ContainsRule implements Rule {
  constructor(public readonly descriptor: Descriptor) {}

  execute(engine: Engine, context: ExecutionContext): void {
    const validator = engine.getValidator(this.descriptor);
    if (!validator) {
      throw new Error(
        `No validator found for descriptor: ${this.descriptor.constructor.name}`
      );
    }
    validator.validate(this.descriptor, engine, context);
  }
}
