// src/modifiers/oneof.ts
// OneOf modifier - matches one of the given options

import { Modifier, validateAny, tryMatch, type Validatable, isLiteralValue } from '../base.js';
import type { Context } from '../context.js';

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
