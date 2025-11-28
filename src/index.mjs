// SpecSpec: 通用 DSL 引擎入口

import {
  PackageAssertion,
  SpecAssertion,
  IsOneOfAssertion,
  ContainsFileAssertion,
  IsJSONAssertion,
  HasFieldAssertion,
  DirectoryDescriptor,
  FileDescriptor
} from './core-rules.mjs';

export { ValidationEngine } from './engine.mjs';
export * as CoreRules from './core-rules.mjs';

// 组装一套“默认 DSL 工厂”，方便业务侧直接使用
export function createCoreDsl() {
  return {
    // 顶层容器
    Package: (opts) => new PackageAssertion(opts),
    Spec: (name, rules) => new SpecAssertion(name, rules),

    // 主语 $
    $: {
      Is: {
        OneOf: (descriptors) => new IsOneOfAssertion(descriptors),
        JSON: () => new IsJSONAssertion()
      },
      Contains: {
        File: (opts) => new ContainsFileAssertion(opts)
      },
      Has: {
        Field: (opts) => new HasFieldAssertion(opts)
      }
    },

    // 描述符
    Directory: (opts) => new DirectoryDescriptor(opts),
    File: (opts) => new FileDescriptor(opts)
  };
}

