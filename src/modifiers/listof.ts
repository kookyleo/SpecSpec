// src/modifiers/listof.ts
// ListOf modifier - validates arrays

import { Modifier, validateAny, type Validatable } from '../base.js';
import type { Context } from '../context.js';

export interface ListOfSpec {
  min?: number;
  max?: number;
}

export class ListOfModifier extends Modifier<unknown[]> {
  constructor(
    private readonly itemType: Validatable,
    private readonly spec?: ListOfSpec
  ) {
    super();
  }

  validate(value: unknown, ctx: Context): void {
    if (!Array.isArray(value)) {
      ctx.addIssue('type.mismatch', `Expected array, got ${typeof value}`);
      return;
    }

    const spec = this.spec;

    // Validate length constraints
    if (spec?.min !== undefined && value.length < spec.min) {
      ctx.addIssue('list.too_short', `Array length ${value.length} is less than minimum ${spec.min}`);
    }

    if (spec?.max !== undefined && value.length > spec.max) {
      ctx.addIssue('list.too_long', `Array length ${value.length} exceeds maximum ${spec.max}`);
    }

    // Validate each item
    value.forEach((item, index) => {
      const childCtx = ctx.child(`[${index}]`, item);
      validateAny(this.itemType, item, childCtx);
    });
  }

  matches(value: unknown, _ctx: Context): boolean {
    if (!Array.isArray(value)) return false;

    const spec = this.spec;
    if (spec?.min !== undefined && value.length < spec.min) return false;
    if (spec?.max !== undefined && value.length > spec.max) return false;

    return true;
  }
}

/**
 * ListOf - value must be an array of the given item type
 *
 * @example
 * // Simple
 * ListOf(Str)
 *
 * // With constraints
 * ListOf(Str, { min: 1, max: 10 })
 *
 * // Complex items
 * ListOf(OneOf('a', 'b', 'c'))
 *
 * // Object items
 * ListOf({ required: [Field({ key: 'name', value: Str })] })
 */
export function ListOf(itemType: Validatable, spec?: ListOfSpec): ListOfModifier {
  return new ListOfModifier(itemType, spec);
}
