// src/assertions/contains.mjs
// ContainsAssertion - uses Validator to validate Descriptor

import { Assertion } from './base.mjs';

export class ContainsAssertion extends Assertion {
  constructor(descriptor) {
    super();
    this.descriptor = descriptor;
  }

  execute(engine, context) {
    const validator = engine.getValidator(this.descriptor);
    if (!validator) {
      throw new Error(`No validator found for descriptor: ${this.descriptor.constructor.name}`);
    }
    validator.validate(this.descriptor, engine, context);
  }
}
