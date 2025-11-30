// src/base.ts
// Type 和 Modifier 基类

import type { Context, Issue } from './context.js';

/**
 * Type 基类 - 所有类型的基础
 *
 * @template TSpec - 规格类型
 * @template TValue - 值类型
 */
export abstract class Type<TSpec = unknown, TValue = unknown> {
  constructor(public readonly spec: TSpec) {}

  /**
   * 验证值是否符合类型约束
   */
  abstract validate(value: TValue, ctx: Context): void;

  /**
   * 检查值是否匹配此类型（用于 OneOf）
   * 默认实现：尝试验证，无错误则匹配
   */
  matches(value: unknown, ctx: Context): boolean {
    const testCtx = new TestContext(ctx);
    this.validate(value as TValue, testCtx);
    return testCtx.hasNoErrors();
  }
}

/**
 * Modifier 基类 - 修饰符（OneOf, ListOf 等）
 */
export abstract class Modifier<TValue = unknown> {
  /**
   * 验证值
   */
  abstract validate(value: TValue, ctx: Context): void;

  /**
   * 检查值是否匹配（用于嵌套 OneOf）
   */
  matches(value: unknown, ctx: Context): boolean {
    const testCtx = new TestContext(ctx);
    this.validate(value as TValue, testCtx);
    return testCtx.hasNoErrors();
  }
}

/**
 * Test context - for silent validation in matches()
 */
class TestContext implements Context {
  path: string[];
  readonly issues: Issue[] = [];
  value: unknown;

  constructor(parent: Context) {
    this.path = [...parent.path];
    this.value = parent.value;
  }

  addIssue(code: string, message: string): void {
    this.issues.push({ level: 'error', code, message, path: [...this.path] });
  }

  addWarning(code: string, message: string): void {
    this.issues.push({ level: 'warning', code, message, path: [...this.path] });
  }

  child(segment: string, value: unknown): Context {
    const childCtx = new TestContext(this);
    childCtx.path = [...this.path, segment];
    childCtx.value = value;
    return childCtx;
  }

  hasNoErrors(): boolean {
    return this.issues.filter(i => i.level === 'error').length === 0;
  }
}

/**
 * 可验证对象的联合类型
 */
export type Validatable = Type | Modifier | LiteralValue;

/**
 * 字面量值类型
 */
export type LiteralValue = string | number | boolean | RegExp | null | undefined;

/**
 * 判断是否为 Type 实例
 */
export function isType(v: unknown): v is Type {
  return v instanceof Type;
}

/**
 * 判断是否为 Modifier 实例
 */
export function isModifier(v: unknown): v is Modifier {
  return v instanceof Modifier;
}

/**
 * 判断是否为字面量值
 */
export function isLiteralValue(v: unknown): v is LiteralValue {
  if (v === null || v === undefined) return true;
  const t = typeof v;
  return t === 'string' || t === 'number' || t === 'boolean' || v instanceof RegExp;
}

/**
 * 验证任意可验证对象
 */
export function validateAny(schema: Validatable, value: unknown, ctx: Context): void {
  if (isType(schema)) {
    schema.validate(value, ctx);
  } else if (isModifier(schema)) {
    schema.validate(value, ctx);
  } else if (isLiteralValue(schema)) {
    // 字面量值直接比较
    if (schema instanceof RegExp) {
      if (typeof value !== 'string' || !schema.test(value)) {
        ctx.addIssue('literal.pattern_mismatch', `Expected to match ${schema}`);
      }
    } else if (value !== schema) {
      ctx.addIssue('literal.mismatch', `Expected ${JSON.stringify(schema)}, got ${JSON.stringify(value)}`);
    }
  } else {
    // 当作对象结构处理（{ required: [], optional: [] }）
    validateObjectSpec(schema as ObjectSpec, value, ctx);
  }
}

/**
 * 对象规格（用于内联定义）
 */
export interface ObjectSpec {
  required?: Validatable[];
  optional?: Validatable[];
}

/**
 * 判断是否为对象规格
 */
export function isObjectSpec(v: unknown): v is ObjectSpec {
  if (v === null || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return Array.isArray(obj['required']) || Array.isArray(obj['optional']);
}

/**
 * 验证对象规格
 */
export function validateObjectSpec(spec: ObjectSpec, value: unknown, ctx: Context): void {
  if (value === null || typeof value !== 'object') {
    ctx.addIssue('type.mismatch', `Expected object, got ${typeof value}`);
    return;
  }

  for (const field of spec.required ?? []) {
    validateAny(field, value, ctx);
  }

  for (const field of spec.optional ?? []) {
    validateAny(field, value, ctx);
  }
}

/**
 * 尝试匹配（用于 OneOf）
 */
export function tryMatch(schema: Validatable, value: unknown, ctx: Context): boolean {
  if (isType(schema)) {
    return schema.matches(value, ctx);
  } else if (isModifier(schema)) {
    return schema.matches(value, ctx);
  } else if (isLiteralValue(schema)) {
    if (schema instanceof RegExp) {
      return typeof value === 'string' && schema.test(value);
    }
    return value === schema;
  } else if (isObjectSpec(schema)) {
    // 对象规格：尝试验证
    const testCtx = new TestContext(ctx);
    validateObjectSpec(schema, value, testCtx);
    return testCtx.hasNoErrors();
  }
  return false;
}
