// SpecSpec: 通用 DSL 引擎入口

import * as Assertions from './assertions/index.mjs';
import * as Descriptors from './descriptors/index.mjs';
import * as Validators from './validators/index.mjs';
import { Spec } from './spec.mjs';
import { ValidationEngine } from './engine.mjs';

export { ValidationEngine, Assertions, Descriptors, Validators, Spec };

// Re-export context classes for extensibility
export {
  TargetExecutionContext,
  FileExecutionContext,
  FieldContext,
} from './contexts/index.mjs';

// 组装一套"默认 DSL 工厂"，方便业务侧直接使用
export function createCoreDsl() {
  // 逻辑否定
  const Not = (assertion) => new Assertions.NotAssertion(assertion);

  // 类型描述符（供 $.Is.OneOf 使用）
  const Directory = (opts) => new Descriptors.DirectoryDescriptor(opts);
  const FileType = (opts) => new Descriptors.FileTypeDescriptor(opts);

  // 内容描述符（供 $.Contains 使用）
  const Package = (opts) => new Descriptors.PackageDescriptor(opts);
  const File = (opts) => new Descriptors.FileDescriptor(opts);
  const Field = (opts) => new Descriptors.FieldDescriptor(opts);

  // Is 系列工厂
  const Is = {
    OneOf: (descriptors) => new Assertions.IsOneOfAssertion(descriptors),
    JSON: () => new Assertions.IsJSONAssertion(),
    String: () => new Assertions.IsStringAssertion(),
    Empty: () => new Assertions.IsEmptyAssertion(),
  };

  // 链式否定：$.Is.Not.X()
  Is.Not = {
    Empty: () => Not(Is.Empty()),
  };

  // Contains 谓词
  const Contains = (descriptor) => new Assertions.ContainsAssertion(descriptor);
  Contains.File = (opts) => new Assertions.ContainsAssertion(File(opts));
  Contains.Field = (opts) => new Assertions.ContainsAssertion(Field(opts));

  // Has 语义语法糖
  const Has = {
    Field: (opts) => new Assertions.ContainsAssertion(Field(opts)),
    RequiredField: (opts) => new Assertions.ContainsAssertion(Field({ ...opts, required: true })),
    OptionalField: (opts) => new Assertions.ContainsAssertion(Field({ ...opts, required: false })),
  };

  const $ = {
    Is,
    Contains,
    Has,
    Not,
    DoesNot: {
      Contain: (descriptor) => Not(new Assertions.ContainsAssertion(descriptor)),
    },
  };

  return {
    // 规则容器
    Spec: (name, rules) => new Spec(name, rules),

    // 描述符
    Package,
    Directory,
    FileType,
    File,
    Field,

    // 逻辑
    Not,

    // 主语 $
    $,
  };
}

// 创建引擎并注册默认配置
export function createConfiguredEngine() {
  const engine = new ValidationEngine();

  engine.registerValidator(Descriptors.PackageDescriptor, new Validators.PackageValidator());
  engine.registerValidator(Descriptors.FileDescriptor, new Validators.FileValidator());
  engine.registerValidator(Descriptors.FieldDescriptor, new Validators.FieldValidator());
  engine.registerValidator(Descriptors.DirectoryDescriptor, new Validators.DirectoryMatcher());
  engine.registerValidator(Descriptors.FileTypeDescriptor, new Validators.FileTypeMatcher());

  const dsl = createCoreDsl();
  engine.registerRules(dsl);

  return { engine, dsl };
}
