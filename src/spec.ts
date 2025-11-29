// src/spec.ts

import type { Spec as ISpec, Rule } from './types.js';

export class Spec implements ISpec {
  constructor(
    public readonly name: string,
    public readonly rules: Rule[]
  ) {}
}
