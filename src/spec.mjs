// src/spec.mjs
// Spec - rule container (not an Assertion)

export class Spec {
  constructor(name, rules) {
    this.name = name;
    this.rules = rules;
  }
}
