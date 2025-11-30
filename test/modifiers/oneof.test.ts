// test/modifiers/oneof.test.ts

import { describe, it, expect } from 'vitest';
import { OneOf } from '../../dist/modifiers/oneof.js';
import { Str, Num } from '../../dist/types/primitives.js';
import { Field } from '../../dist/types/structural.js';
import { createTestContext } from '../helpers.js';

describe('OneOf', () => {
  describe('with literal values', () => {
    it('accepts matching value', () => {
      const ctx = createTestContext();
      OneOf('a', 'b', 'c').validate('b', ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('rejects non-matching value', () => {
      const ctx = createTestContext();
      OneOf('a', 'b', 'c').validate('d', ctx);
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].code).toBe('oneof.no_match');
    });

    it('accepts numeric literal', () => {
      const ctx = createTestContext();
      OneOf(1, 2, 3).validate(2, ctx);
      expect(ctx.issues).toHaveLength(0);
    });
  });

  describe('with types', () => {
    it('accepts string when Str is option', () => {
      const ctx = createTestContext();
      OneOf(Str(), Num()).validate('hello', ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('accepts number when Num is option', () => {
      const ctx = createTestContext();
      OneOf(Str(), Num()).validate(42, ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('rejects value matching no type', () => {
      const ctx = createTestContext();
      OneOf(Str(), Num()).validate(true, ctx);
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].code).toBe('oneof.no_match');
    });
  });

  describe('with mixed literals and types', () => {
    it('accepts literal match', () => {
      const ctx = createTestContext();
      OneOf('auto', Num({ min: 0 })).validate('auto', ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('accepts type match', () => {
      const ctx = createTestContext();
      OneOf('auto', Num({ min: 0 })).validate(100, ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('rejects value that fails type constraints', () => {
      const ctx = createTestContext();
      OneOf('auto', Num({ min: 0 })).validate(-5, ctx);
      // -5 doesn't match 'auto' and fails Num({ min: 0 }) constraint
      // So it reports no match (matches() returns false for invalid values)
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].code).toBe('oneof.no_match');
    });
  });

  describe('with object specs (discriminated unions)', () => {
    const TypeA = {
      required: [
        Field({ key: 'type', value: 'a' }),
        Field({ key: 'valueA', value: Str() })
      ]
    };

    const TypeB = {
      required: [
        Field({ key: 'type', value: 'b' }),
        Field({ key: 'valueB', value: Num() })
      ]
    };

    it('accepts TypeA object', () => {
      const ctx = createTestContext();
      OneOf(TypeA, TypeB).validate({ type: 'a', valueA: 'hello' }, ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('accepts TypeB object', () => {
      const ctx = createTestContext();
      OneOf(TypeA, TypeB).validate({ type: 'b', valueB: 42 }, ctx);
      expect(ctx.issues).toHaveLength(0);
    });

    it('validates matched type constraints', () => {
      const ctx = createTestContext();
      OneOf(TypeA, TypeB).validate({ type: 'a', valueA: 123 }, ctx);
      // Matches TypeA by discriminator but fails valueA type
      expect(ctx.issues.length).toBeGreaterThan(0);
    });
  });
});
