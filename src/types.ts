// src/types.ts
// Core interfaces and types

import type { Stats } from 'node:fs';

// ============================================
// Context Interfaces
// ============================================

export interface Issue {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
}

export interface BaseContext {
  addIssue(code: string, message: string): void;
}

export interface TargetContext extends BaseContext {
  path: string;
  stat: Stats | null;
  issues: Issue[];
  createFileContext(relativePath: string): FileContext;
}

export interface FileContext extends BaseContext {
  packageContext: TargetContext;
  filePath: string;
  fullPath: string;
  stat: Stats | null;
  content(): string;
  json(): unknown | null;
  createFieldContext(fieldName: string, fieldValue: unknown): FieldContext;
}

export interface FieldContext extends BaseContext {
  fileContext: FileContext;
  fieldName: string;
  value: unknown;
}

export type ExecutionContext = TargetContext | FileContext | FieldContext;

// ============================================
// Descriptor Interface
// ============================================

export interface DescriptorOptions {
  [key: string]: unknown;
}

export interface Descriptor<T extends DescriptorOptions = DescriptorOptions> {
  readonly opts: T;
}

// ============================================
// Rule Interface
// ============================================

export interface Rule {
  execute(engine: Engine, context: ExecutionContext): void;
}

// ============================================
// Validator Interface
// ============================================

export interface Validator<D extends Descriptor = Descriptor> {
  /**
   * Validate the descriptor against the context.
   * Reports issues if validation fails.
   */
  validate(descriptor: D, engine: Engine, context: ExecutionContext): void;

  /**
   * Check if the descriptor matches the context.
   * Used by IsOneOf rule. Returns true/false without reporting issues.
   */
  matches?(descriptor: D, engine: Engine, context: ExecutionContext): boolean;
}

// ============================================
// Spec Interface
// ============================================

export interface Spec {
  readonly name: string;
  readonly rules: Rule[];
}

// ============================================
// Engine Interface
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DescriptorConstructor<D extends Descriptor = Descriptor> = new (...args: any[]) => D;

export interface Engine {
  readonly ruleFactories: Record<string, unknown>;

  registerValidator<D extends Descriptor>(
    descriptorClass: DescriptorConstructor<D>,
    validator: Validator<D>
  ): void;

  getValidator<D extends Descriptor>(descriptor: D): Validator<D> | undefined;

  registerRules(factories: Record<string, unknown>): void;

  run(specPath: string, targetPath: string): ValidationResult;

  executeInContext<T>(context: ExecutionContext, func: () => T): T;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
}

// ============================================
// DSL Types
// ============================================

export interface IsPredicates {
  OneOf(descriptors: Descriptor[]): Rule;
  JSON(): Rule;
  String(): Rule;
  Empty(): Rule;
}

export interface IsNotPredicates {
  Empty(): Rule;
  JSON(): Rule;
  String(): Rule;
}

export interface ContainsFactory {
  (descriptor: Descriptor): Rule;
  File(opts: FileDescriptorOptions): Rule;
  Field(opts: FieldDescriptorOptions): Rule;
}

export interface HasFactory {
  Field(opts: FieldDescriptorOptions): Rule;
  RequiredField(opts: Omit<FieldDescriptorOptions, 'required'>): Rule;
  OptionalField(opts: Omit<FieldDescriptorOptions, 'required'>): Rule;
}

export interface DoesNotPredicates {
  Contain(descriptor: Descriptor): Rule;
}

export interface DollarSign {
  Is: IsPredicates;
  IsNot: IsNotPredicates;
  Contains: ContainsFactory;
  Has: HasFactory;
  DoesNot: DoesNotPredicates;
}

// ============================================
// Descriptor Options Types
// ============================================

export interface PackageDescriptorOptions extends DescriptorOptions {
  withSpec?: () => Spec;
}

export interface FileDescriptorOptions extends DescriptorOptions {
  path?: string;
  withExtension?: string;
  withSpec?: () => Spec;
}

export interface FieldDescriptorOptions extends DescriptorOptions {
  key: string;
  required?: boolean;
  withSpec?: () => Spec;
  is?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DirectoryDescriptorOptions extends DescriptorOptions {
  // Reserved for future options
}
