// src/validators/base.mjs
// Validator base class

export class Validator {
  validate(descriptor, engine, context) {
    throw new Error(`Validator '${this.constructor.name}' must implement 'validate'.`);
  }
}
