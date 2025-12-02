// src/types/primitives.ts
// 基础类型：Str, Bool, Num

import { Type, type TypeDescription } from '../base.js';
import type { Context } from '../context.js';

// ═══════════════════════════════════════════════════════════════
// Str - 字符串类型
// ═══════════════════════════════════════════════════════════════

export interface StrSpec {
  /** Human-readable description */
  description?: string;
  minLength?: number;
  maxLength?: number;
  match?: RegExp;
}

export class StrType extends Type<StrSpec | undefined, string> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'string') {
      ctx.addIssue('type.mismatch', `Expected string, got ${typeof value}`);
      return;
    }

    const spec = this.spec;
    if (!spec) return;

    if (spec.minLength !== undefined && value.length < spec.minLength) {
      ctx.addIssue('str.too_short', `String length ${value.length} is less than minimum ${spec.minLength}`);
    }

    if (spec.maxLength !== undefined && value.length > spec.maxLength) {
      ctx.addIssue('str.too_long', `String length ${value.length} exceeds maximum ${spec.maxLength}`);
    }

    if (spec.match !== undefined && !spec.match.test(value)) {
      ctx.addIssue('str.pattern_mismatch', `String does not match pattern ${spec.match}`);
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.minLength !== undefined) {
      constraints.push(`minimum ${this.spec.minLength} characters`);
    }
    if (this.spec?.maxLength !== undefined) {
      constraints.push(`maximum ${this.spec.maxLength} characters`);
    }
    if (this.spec?.match) {
      constraints.push(`matches \`${this.spec.match}\``);
    }
    return {
      name: 'String',
      description: this.spec?.description,
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }
}

// DSL 工厂
const defaultStr = new StrType(undefined);
export const Str = Object.assign(
  (spec?: StrSpec) => spec ? new StrType(spec) : defaultStr,
  { _default: defaultStr }
);

// ═══════════════════════════════════════════════════════════════
// Bool - 布尔类型
// ═══════════════════════════════════════════════════════════════

export interface BoolSpec {
  /** Human-readable description */
  description?: string;
  default?: boolean;
}

export class BoolType extends Type<BoolSpec | undefined, boolean> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'boolean') {
      ctx.addIssue('type.mismatch', `Expected boolean, got ${typeof value}`);
      return;
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.default !== undefined) {
      constraints.push(`default: ${this.spec.default}`);
    }
    return {
      name: 'Boolean',
      description: this.spec?.description,
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }
}

const defaultBool = new BoolType(undefined);
export const Bool = Object.assign(
  (spec?: BoolSpec) => spec ? new BoolType(spec) : defaultBool,
  { _default: defaultBool }
);

// ═══════════════════════════════════════════════════════════════
// Num - 数值类型
// ═══════════════════════════════════════════════════════════════

export interface NumSpec {
  /** Human-readable description */
  description?: string;
  min?: number;
  max?: number;
  integer?: boolean;
}

export class NumType extends Type<NumSpec | undefined, number> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      ctx.addIssue('type.mismatch', `Expected number, got ${typeof value}`);
      return;
    }

    const spec = this.spec;
    if (!spec) return;

    if (spec.integer && !Number.isInteger(value)) {
      ctx.addIssue('num.not_integer', `Expected integer, got ${value}`);
    }

    if (spec.min !== undefined && value < spec.min) {
      ctx.addIssue('num.too_small', `Number ${value} is less than minimum ${spec.min}`);
    }

    if (spec.max !== undefined && value > spec.max) {
      ctx.addIssue('num.too_large', `Number ${value} exceeds maximum ${spec.max}`);
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.integer) {
      constraints.push('integer');
    }
    if (this.spec?.min !== undefined) {
      constraints.push(`minimum ${this.spec.min}`);
    }
    if (this.spec?.max !== undefined) {
      constraints.push(`maximum ${this.spec.max}`);
    }
    return {
      name: 'Number',
      description: this.spec?.description,
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }
}

const defaultNum = new NumType(undefined);
export const Num = Object.assign(
  (spec?: NumSpec) => spec ? new NumType(spec) : defaultNum,
  { _default: defaultNum }
);
