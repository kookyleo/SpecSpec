// test/types/primitives.test.ts

import { describe, it, expect } from 'vitest';
import { Str, Bool, Num } from '../../dist/types/primitives.js';
import { createTestContext } from '../helpers.js';

describe('Str', () => {
  it('accepts valid string', () => {
    const ctx = createTestContext();
    Str().validate('hello', ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('rejects non-string', () => {
    const ctx = createTestContext();
    Str().validate(123, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('type.mismatch');
  });

  it('validates minLength', () => {
    const ctx = createTestContext();
    Str({ minLength: 3 }).validate('ab', ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('str.too_short');
  });

  it('validates maxLength', () => {
    const ctx = createTestContext();
    Str({ maxLength: 3 }).validate('abcd', ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('str.too_long');
  });

  it('validates pattern match', () => {
    const ctx = createTestContext();
    Str({ match: /^\d+$/ }).validate('abc', ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('str.pattern_mismatch');
  });

  it('passes with valid pattern', () => {
    const ctx = createTestContext();
    Str({ match: /^\d+$/ }).validate('123', ctx);
    expect(ctx.issues).toHaveLength(0);
  });
});

describe('Bool', () => {
  it('accepts true', () => {
    const ctx = createTestContext();
    Bool().validate(true, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('accepts false', () => {
    const ctx = createTestContext();
    Bool().validate(false, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('rejects non-boolean', () => {
    const ctx = createTestContext();
    Bool().validate('true', ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('type.mismatch');
  });
});

describe('Num', () => {
  it('accepts valid number', () => {
    const ctx = createTestContext();
    Num().validate(42, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('accepts zero', () => {
    const ctx = createTestContext();
    Num().validate(0, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('accepts negative numbers', () => {
    const ctx = createTestContext();
    Num().validate(-10, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('accepts floats', () => {
    const ctx = createTestContext();
    Num().validate(3.14, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('rejects non-number', () => {
    const ctx = createTestContext();
    Num().validate('42', ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('type.mismatch');
  });

  it('rejects NaN', () => {
    const ctx = createTestContext();
    Num().validate(NaN, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('type.mismatch');
  });

  it('validates min', () => {
    const ctx = createTestContext();
    Num({ min: 10 }).validate(5, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('num.too_small');
  });

  it('validates max', () => {
    const ctx = createTestContext();
    Num({ max: 10 }).validate(15, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('num.too_large');
  });

  it('validates integer', () => {
    const ctx = createTestContext();
    Num({ integer: true }).validate(3.14, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('num.not_integer');
  });

  it('passes integer check for whole numbers', () => {
    const ctx = createTestContext();
    Num({ integer: true }).validate(42, ctx);
    expect(ctx.issues).toHaveLength(0);
  });
});
