// SpecSpec/src/assertions/contains.mjs
// Generic "Contains" assertion

import { Assertion } from './base.mjs';

export class ContainsAssertion extends Assertion {
  constructor(descriptor) {
    super();
    this.descriptor = descriptor;
  }

  execute(engine, context) {
    // Polymorphically execute the descriptor, which is now an assertion itself.
    this.descriptor.execute(engine, context);
  }
}
