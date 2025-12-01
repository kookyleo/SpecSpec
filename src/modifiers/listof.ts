// src/modifiers/listof.ts
// ListOf modifier - validates arrays

import { Modifier, validateAny, type Validatable, type TypeDescription, isType, isModifier, isLiteralValue, isObjectSpec } from '../base.js';
import type { Context } from '../context.js';

export interface ListOfSpec {
  min?: number;
  max?: number;
}

// Helper to describe item type
function describeItem(v: Validatable): TypeDescription {
  if (isType(v)) {
    return v.describe();
  } else if (isModifier(v)) {
    return v.describe();
  } else if (isLiteralValue(v)) {
    if (v instanceof RegExp) {
      return { name: 'Pattern', constraints: [`matches \`${v}\``] };
    }
    return { name: 'Literal', constraints: [`equals ${JSON.stringify(v)}`] };
  } else if (isObjectSpec(v)) {
    return { name: 'Object', spec: v };
  }
  return { name: 'Unknown' };
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

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.min !== undefined) {
      constraints.push(`minimum ${this.spec.min} items`);
    }
    if (this.spec?.max !== undefined) {
      constraints.push(`maximum ${this.spec.max} items`);
    }
    return {
      name: 'ListOf',
      constraints: constraints.length > 0 ? constraints : undefined,
      itemType: describeItem(this.itemType),
    };
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
