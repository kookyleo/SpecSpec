// src/object.ts
// ObjectType - generic object with required/optional fields and discriminator support

import { Type, validateAny, tryMatch, type Context, type TypeDescription, type Validatable } from '@specspec/core';

/**
 * Discriminator for type matching in OneOf
 */
export interface Discriminator {
  /** Field key to check */
  key: string;
  /** Expected value (or values). Use Symbol.for('exists') to check field presence only */
  value: unknown | unknown[];
}

/** Symbol to indicate "check field exists" rather than matching a value */
export const EXISTS = Symbol.for('specspec.exists');

/**
 * ObjectType spec
 */
export interface ObjectSpec {
  /** Required fields */
  required?: Validatable[];
  /** Optional fields */
  optional?: Validatable[];
  /** Discriminator for OneOf matching */
  discriminator?: Discriminator;
}

/**
 * Resolve type factory to instance
 */
function resolveType(typeOrFactory: unknown): Validatable {
  if (typeof typeOrFactory === 'function' && '_default' in typeOrFactory) {
    return (typeOrFactory as { _default: Validatable })._default;
  }
  return typeOrFactory as Validatable;
}

/**
 * ObjectType - validates objects with required/optional field structure
 *
 * @example
 * // Simple object
 * ObjectType({
 *   required: [
 *     Field({ key: 'name', value: Str() }),
 *     Field({ key: 'age', value: Num() })
 *   ]
 * })
 *
 * @example
 * // With discriminator for OneOf matching
 * ObjectType({
 *   discriminator: { key: 'type', value: 'user' },
 *   required: [
 *     Field({ key: 'type', value: OneOf('user') }),
 *     Field({ key: 'name', value: Str() })
 *   ]
 * })
 */
export class ObjectTypeClass extends Type<ObjectSpec, unknown> {
  validate(value: unknown, ctx: Context): void {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      ctx.addIssue('type.mismatch', `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}`);
      return;
    }

    const { required, optional } = this.spec ?? {};

    // Validate required fields
    for (const field of required ?? []) {
      validateAny(resolveType(field), value, ctx);
    }

    // Validate optional fields
    for (const field of optional ?? []) {
      const resolved = resolveType(field);
      // Mark as optional if it has a spec
      if (resolved && typeof resolved === 'object' && 'spec' in resolved) {
        const typeWithSpec = resolved as Type<{ optional?: boolean }>;
        if (typeWithSpec.spec && typeof typeWithSpec.spec === 'object') {
          (typeWithSpec.spec as { optional?: boolean }).optional = true;
        }
      }
      validateAny(resolved, value, ctx);
    }
  }

  matches(value: unknown, ctx: Context): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const obj = value as Record<string, unknown>;
    const { discriminator, required } = this.spec ?? {};

    // Check discriminator first (fast path)
    if (discriminator) {
      // EXISTS symbol means "check field exists"
      if (discriminator.value === EXISTS || discriminator.value === Symbol.for('specspec.exists')) {
        if (!(discriminator.key in obj)) {
          return false;
        }
      } else {
        const actualValue = obj[discriminator.key];
        const expectedValues = Array.isArray(discriminator.value)
          ? discriminator.value
          : [discriminator.value];
        if (!expectedValues.includes(actualValue)) {
          return false;
        }
      }
    }

    // Check required fields match
    for (const field of required ?? []) {
      if (!tryMatch(resolveType(field), value, ctx)) {
        return false;
      }
    }

    return true;
  }

  describe(): TypeDescription {
    const { required, optional, discriminator } = this.spec ?? {};

    // Build summary with discriminator info
    let summary: string | undefined;
    if (discriminator) {
      if (discriminator.value === EXISTS || discriminator.value === Symbol.for('specspec.exists')) {
        summary = `${discriminator.key} 存在`;
      } else {
        const valStr = JSON.stringify(discriminator.value);
        summary = `${discriminator.key}=${valStr}`;
      }
    }

    const desc: TypeDescription = {
      name: 'Object',
      summary,
    };

    if ((required && required.length > 0) || (optional && optional.length > 0)) {
      desc.children = {};

      if (required && required.length > 0) {
        desc.children.required = required.map(f => {
          const resolved = resolveType(f);
          if (resolved && typeof resolved === 'object' && 'describe' in resolved) {
            return (resolved as Type).describe();
          }
          return { name: 'Unknown', spec: f };
        });
      }

      if (optional && optional.length > 0) {
        desc.children.optional = optional.map(f => {
          const resolved = resolveType(f);
          if (resolved && typeof resolved === 'object' && 'describe' in resolved) {
            const childDesc = (resolved as Type).describe();
            return { ...childDesc, optional: true };
          }
          return { name: 'Unknown', spec: f, optional: true };
        });
      }
    }

    return desc;
  }
}

/**
 * Create an ObjectType
 */
export function ObjectType(spec: ObjectSpec): ObjectTypeClass {
  return new ObjectTypeClass(spec);
}
