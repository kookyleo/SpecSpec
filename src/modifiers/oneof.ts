// src/modifiers/oneof.ts
// OneOf modifier - matches one of the given options

import { Modifier, validateAny, tryMatch, type Validatable, type TypeDescription, isLiteralValue, isType, isModifier, isObjectSpec } from '../base.js';
import type { Context } from '../context.js';

// Helper to describe any Validatable
function describeOption(v: Validatable): TypeDescription {
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

export class OneOfModifier extends Modifier<unknown> {
  constructor(private readonly options: Validatable[]) {
    super();
  }

  validate(value: unknown, ctx: Context): void {
    // Try to match any option
    for (const option of this.options) {
      if (tryMatch(option, value, ctx)) {
        // Found a match, validate with this option
        validateAny(option, value, ctx);
        return;
      }
    }

    // No match found
    const optionDescriptions = this.options.map(opt => {
      if (isLiteralValue(opt)) {
        return JSON.stringify(opt);
      }
      return opt.constructor.name;
    });
    ctx.addIssue(
      'oneof.no_match',
      `Value does not match any of: ${optionDescriptions.join(', ')}`
    );
  }

  matches(value: unknown, ctx: Context): boolean {
    for (const option of this.options) {
      if (tryMatch(option, value, ctx)) {
        return true;
      }
    }
    return false;
  }

  describe(): TypeDescription {
    return {
      name: 'OneOf',
      oneOf: this.options.map(describeOption),
    };
  }
}

/**
 * OneOf - value must match one of the given options
 *
 * @example
 * // Literal values
 * OneOf('a', 'b', 'c')
 *
 * // Types
 * OneOf(Str, Num)
 *
 * // Mixed
 * OneOf('auto', Num({ min: 0 }))
 *
 * // Discriminated union
 * OneOf(
 *   { required: [Field({ key: 'type', value: 'a' }), Field({ key: 'valueA', value: Str })] },
 *   { required: [Field({ key: 'type', value: 'b' }), Field({ key: 'valueB', value: Num })] }
 * )
 */
export function OneOf(...options: Validatable[]): OneOfModifier {
  return new OneOfModifier(options);
}
