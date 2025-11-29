// SpecSpec: 通用 DSL 引擎入口

import * as CoreRules from './core-rules.mjs';

export { ValidationEngine } from './engine.mjs';
export { CoreRules };

// 组装一套“默认 DSL 工厂”，方便业务侧直接使用
export function createCoreDsl() {
  // 逻辑否定：接受一个断言实例，返回其 Not 包装
  const Not = (assertion) => new CoreRules.NotAssertion(assertion);

  // 类型描述符（供 $.Is.OneOf 使用）
  const Directory = () => new CoreRules.DirectoryDescriptor();
  const FileType = (opts) => new CoreRules.FileTypeDescriptor(opts);

  // 内容描述符（供 $.Contains 使用）
  const File = (opts) => new CoreRules.FileDescriptor(opts);
  const Field = (opts) => new CoreRules.FieldDescriptor(opts);

  // Is 系列工厂
  const Is = {
    OneOf: (descriptors) => new CoreRules.IsOneOfAssertion(descriptors),
    JSON: () => new CoreRules.IsJSONAssertion(),
    String: () => new CoreRules.IsStringAssertion(),
    Empty: () => new CoreRules.IsEmptyAssertion(),
  };

  // 链式否定：$.Is.Not.X()
  Is.Not = {
    Empty: () => Not(Is.Empty()),
  };

  // Contains 谓词：既支持 $.Contains(File(...)) 也支持 $.Contains.File(...)
  const Contains = (descriptor) => new CoreRules.ContainsAssertion(descriptor);
  Contains.File = (opts) => new CoreRules.ContainsAssertion(File(opts));
  Contains.Field = (opts) => new CoreRules.ContainsAssertion(Field(opts));

  // Has 语义语法糖
  const Has = {
    Field: (opts) => new CoreRules.ContainsAssertion(Field(opts)),
    // RequiredField/OptionalField 语法糖，等价于 Field({ ...opts, required: true/false })
    RequiredField: (opts) => new CoreRules.ContainsAssertion(Field({ ...opts, required: true })),
    OptionalField: (opts) => new CoreRules.ContainsAssertion(Field({ ...opts, required: false })),
  };

  const $ = {
    Is,
    Contains,
    Has,
    // 前缀否定：$.Not($.Is.Empty())
    Not,
    // $.DoesNot.Contain(File(...))
    DoesNot: {
      Contain: (descriptor) => Not(new CoreRules.ContainsAssertion(descriptor)),
    },
  };

  return {
    // 容器：唯一的结构化“规则容器”为 Spec
    // Package 是一个常见的 Descriptor，用于给“包”对象绑定一组规则。
    Package: (opts) => new CoreRules.PackageAssertion(opts),
    Spec: (name, rules) => new CoreRules.SpecAssertion(name, rules),

    // 逻辑
    Not,

    // 主语 $
    $,

    // 描述符
    Directory,
    FileType,
    File,
    Field,
  };
}
