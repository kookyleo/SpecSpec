// test/modifiers/listof.test.ts

import { describe, it, expect } from 'vitest';
import { ListOf } from '../../dist/modifiers/listof.js';
import { OneOf } from '../../dist/modifiers/oneof.js';
import { Str, Num } from '../../dist/types/primitives.js';
import { Field } from '../../dist/types/structural.js';
import { createTestContext } from '../helpers.js';

describe('ListOf', () => {
  it('accepts valid array of strings', () => {
    const ctx = createTestContext();
    ListOf(Str()).validate(['a', 'b', 'c'], ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('accepts empty array', () => {
    const ctx = createTestContext();
    ListOf(Str()).validate([], ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('rejects non-array', () => {
    const ctx = createTestContext();
    ListOf(Str()).validate('not array', ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('type.mismatch');
  });

  it('validates each item', () => {
    const ctx = createTestContext();
    ListOf(Num()).validate([1, 'two', 3], ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].path).toContain('[1]');
  });

  it('validates min length', () => {
    const ctx = createTestContext();
    ListOf(Str(), { min: 2 }).validate(['a'], ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('list.too_short');
  });

  it('validates max length', () => {
    const ctx = createTestContext();
    ListOf(Str(), { max: 2 }).validate(['a', 'b', 'c'], ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('list.too_long');
  });

  it('reports multiple item errors', () => {
    const ctx = createTestContext();
    ListOf(Num()).validate(['a', 'b', 'c'], ctx);
    expect(ctx.issues).toHaveLength(3);
  });

  describe('with complex item types', () => {
    it('validates array of OneOf', () => {
      const ctx = createTestContext();
      ListOf(OneOf('a', 'b', 'c')).validate(['a', 'b', 'd'], ctx);
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].path).toContain('[2]');
    });

    it('validates array of objects', () => {
      const ctx = createTestContext();
      const ItemSpec = {
        required: [
          Field({ key: 'name', value: Str() }),
          Field({ key: 'count', value: Num() })
        ]
      };
      ListOf(ItemSpec).validate([
        { name: 'item1', count: 1 },
        { name: 'item2', count: 'invalid' }
      ], ctx);
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].path).toContain('[1]');
    });
  });
});
