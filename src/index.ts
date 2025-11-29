// src/index.ts
// SpecSpec: 通用 DSL 引擎入口

import { ValidationEngine } from './engine.js';
import { Spec } from './spec.js';
import * as Descriptors from './descriptors/index.js';
import * as Rules from './rules/index.js';
import * as Validators from './validators/index.js';
import type {
  Engine,
  Rule,
  Descriptor,
  DollarSign,
  IsPredicates,
  IsNotPredicates,
  ContainsFactory,
  HasFactory,
  DoesNotPredicates,
} from './types.js';

export { ValidationEngine } from './engine.js';
export { Spec } from './spec.js';
export * from './descriptors/index.js';
export * from './rules/index.js';
export * from './validators/index.js';
export * from './contexts/index.js';
export type * from './types.js';

// 组装一套"默认 DSL 工厂"，方便业务侧直接使用
export function createCoreDsl() {
  // 类型描述符（供 $.Is.OneOf 使用）
  const Directory = () => new Descriptors.DirectoryDescriptor();

  // 内容描述符（供 $.Contains 使用）
  // File 既可以用于路径匹配，也可以用于类型匹配 (withExtension)
  const File = (opts: { path?: string; withExtension?: string; withSpec?: () => Spec } = {}) =>
    new Descriptors.FileDescriptor(opts);
  const Field = (opts: {
    key: string;
    required?: boolean;
    withSpec?: () => Spec;
    is?: string;
  }) => new Descriptors.FieldDescriptor(opts);
  const Package = (opts: { withSpec?: () => Spec } = {}) =>
    new Descriptors.PackageDescriptor(opts);

  // $.Is 系列
  const Is: IsPredicates = {
    OneOf: (descriptors: Descriptor[]) => new Rules.IsOneOfRule(descriptors),
    JSON: () => new Rules.IsJSONRule(),
    String: () => new Rules.IsStringRule(),
    Empty: () => new Rules.IsEmptyRule(),
  };

  // $.IsNot 系列
  const IsNot: IsNotPredicates = {
    Empty: () => new Rules.IsNotRule(new Rules.IsEmptyRule()),
    JSON: () => new Rules.IsNotRule(new Rules.IsJSONRule()),
    String: () => new Rules.IsNotRule(new Rules.IsStringRule()),
  };

  // $.Contains 谓词：既支持 $.Contains(File(...)) 也支持 $.Contains.File(...)
  const Contains: ContainsFactory = Object.assign(
    (descriptor: Descriptor): Rule => new Rules.ContainsRule(descriptor),
    {
      File: (opts: { path: string; withSpec?: () => Spec }): Rule =>
        new Rules.ContainsRule(File(opts)),
      Field: (opts: {
        key: string;
        required?: boolean;
        withSpec?: () => Spec;
        is?: string;
      }): Rule => new Rules.ContainsRule(Field(opts)),
    }
  );

  // $.Has 语义语法糖
  const Has: HasFactory = {
    Field: (opts) => new Rules.ContainsRule(Field(opts)),
    RequiredField: (opts: Omit<Parameters<typeof Field>[0], 'required'>) =>
      new Rules.ContainsRule(Field({ ...opts, required: true })),
    OptionalField: (opts: Omit<Parameters<typeof Field>[0], 'required'>) =>
      new Rules.ContainsRule(Field({ ...opts, required: false })),
  };

  // $.DoesNot 系列
  const DoesNot: DoesNotPredicates = {
    Contain: (descriptor: Descriptor): Rule => {
      const containsRule = new Rules.ContainsRule(descriptor);
      return new Rules.DoesNotRule(containsRule, descriptor);
    },
  };

  const $: DollarSign = {
    Is,
    IsNot,
    Contains,
    Has,
    DoesNot,
  };

  return {
    // Spec 容器
    Spec: (name: string, rules: Rule[]) => new Spec(name, rules),

    // 主语 $
    $,

    // 描述符工厂
    Package,
    Directory,
    File,
    Field,
  };
}

// 创建一个已配置好所有验证器的引擎
export function createConfiguredEngine(): { engine: Engine; dsl: ReturnType<typeof createCoreDsl> } {
  const engine = new ValidationEngine();
  const dsl = createCoreDsl();

  // 注册验证器
  engine.registerValidator(Descriptors.PackageDescriptor, new Validators.PackageValidator());
  engine.registerValidator(Descriptors.FileDescriptor, new Validators.FileValidator());
  engine.registerValidator(Descriptors.FieldDescriptor, new Validators.FieldValidator());
  engine.registerValidator(Descriptors.DirectoryDescriptor, new Validators.DirectoryValidator());

  // 注册 DSL 规则
  engine.registerRules(dsl);

  return { engine, dsl };
}
