# SpecSpec

一个通用的 **Spec DSL 引擎**与核心规则库，用于以自然语言风格的代码来描述和验证软件规约（code-as-spec）。

本项目旨在提供一个足够抽象、高内聚且可扩展的框架，让开发者能够用极其流畅的、接近自然语言的语法来定义验证规则。

---

## 设计哲学

`SpecSpec` 的核心是实现一种“内部 DSL”（Internal DSL）。这意味着：

- **它在语法上是 100% 的纯正 JavaScript**：你不需要学习一门新语言，所有的规约都是在 `.js` 文件中通过函数和对象来定义的。
- **它在语义上是 100% 的领域特定语言**：它提供了一套高度定制的“词汇”和“语法结构”，专门用于“描述和验证规约”这个特定领域。

我们的目标是，让开发者真正做到“直抒规范本身”。

---

## 语言的三大核心概念

我们设计的这门“小语言”由三个清晰的核心概念组成。

### 1. `Spec` - 规约容器 (The Rule Container)

`Spec` 是我们语言中**唯一的结构化容器**。它就像一份文档中的一个“章节”，拥有一个标题和一系列具体的“规则”（断言）。无论是描述整个软件包的顶层规约，还是描述某个文件或字段的子规约，都由 `Spec` 来承载。

```javascript
Spec('My Chapter Title', [
  // ... assertions go here ...
])
```

### 2. `Descriptor` - 描述符 (The Nouns)

“描述符”是语言中的**“名词”**，它们用于描述一个具体的事物类型或子项目，自身不执行断言，而是作为“谓词”的参数。描述符是完全可扩展的。

我们有两种基本类型的描述符：

- **类型描述符 (Type Descriptors)**：用于 `$.Is.OneOf` 谓词，回答“主语是什么类型？”
  - `Directory()`
  - `FileType({ withExtension: '...' })`
  - `ZipFile({ withExtension: '...' })` (业务扩展)

- **内容描述符 (Containment Descriptors)**：用于 `$.Contains` 谓词，回答“主语包含什么？”
  - `File({ path: '...', withSpec: ... })`
  - `Field({ key: '...', withSpec: ... })`
  - `Directory({ path: '...', withSpec: ... })` (可扩展)

### 3. `Predicate` - 谓词 (The Verbs)

“谓词”是语言中的**“动词”**，它对当前主语 `$` 发起一个具体的断言。主语 `$` 是一个动态代词，永远指代当前正在被验证的对象（包、文件或字段）。谓词也是完全可扩展的。

核心谓词库分为几个家族：

- **`Is`**: 断言主语的**状态或类型**。
  - `$.Is.JSON()`
  - `$.Is.String()`
  - `$.Is.Empty()`
  - `$.Is.OneOf([ Directory(), FileType() ])`

- **`Has`**: 断言主语的**属性或元数据**。
  - `$.Has.NameMatching(/.../)`
  - `$.Has.Length({ min, max })`

- **`Contains`**: 断言主语**包含**某个子项目（由一个“内容描述符”定义）。
  - `$.Contains(File({ path: '...', ... }))`
  - `$.Contains(Field({ key: '...', ... }))`

- **否定逻辑**: 提供两种流畅的否定形式。
  - **链式 `.Not`**: `$.Is.Not.Empty()`
  - **前缀 `DoesNot`**: `$.DoesNot.Contain(File({ path: '...' }))`

---

## 架构与扩展性

`SpecSpec` 的设计严格遵循“关注点分离”原则，分为清晰的三层：

1.  **引擎 (`engine.mjs`)**: 通用的执行核心，完全与业务无关。
2.  **核心规则库 (`core-rules.mjs`)**: 一套可复用的“标准库”，包含最通用的 `Spec`, `Descriptor` 和 `Predicate` 的实现。
3.  **业务规则库 (例如 `asks-rules.mjs`)**: 针对特定业务领域的扩展，可以定义自己的描述符和谓词。

---

## 快速上手

### 1. 编写你的 `Spec.js`

```javascript
// Spec.js
// 整个文件就是一个顶级的 Spec 对象
Spec('Asks Package Specification', [
  // 这些规则都将自动作用于根目标（“包”）上
  $.Is.OneOf([
    Directory(),
    ZipFile({ withExtension: 'asks' })
  ]),
  
  $.Has.NameMatching(/^[A-Za-z_][A-Za-z0-9_]*$/),
  
  $.Contains(File({
    path: 'manifest.json',
    withSpec: () => Spec('Manifest Rules', [
      // 在这里, $ 的上下文自动切换为 manifest.json 文件
      $.Is.JSON(),
      
      $.Contains(Field({ 
        key: 'name', 
        required: true,
        withSpec: () => Spec('Name Field Rules', [
          // 在这里, $ 的上下文自动切换为 name 字段的值
          $.Is.String(),
          $.Is.Not.Empty()
        ])
      }))
    ])
  })),

  $.DoesNot.Contain(File({ path: 'debug.log' }))
]);
```

### 2. 创建你的执行入口 (`validate.mjs`)

```javascript
import { ValidationEngine, createCoreDsl } from '@kookyleo/specspec';
import * as AsksRules from './asks-rules.mjs'; 
import path from 'node:path';

// 1. 创建引擎实例
const engine = new ValidationEngine();

// 2. 获取核心 DSL，并用你的业务规则来增强或覆盖它
const dsl = createCoreDsl();
dsl.ZipFile = (opts) => new AsksRules.ZipFileDescriptor(opts);
dsl.$.Is.NameMatching = (regex) => new AsksRules.IsNameMatchingAssertion(regex);
dsl.$.Contains.Field = (opts) => new AsksRules.HasFieldAssertion(opts); // 覆盖核心 Field 实现

// 3. 将最终的 DSL 注册到引擎
engine.registerRules(dsl);

// 4. 运行验证
const specPath = path.resolve(__dirname, '../Spec.js');
const targetPath = process.argv[2];
const results = engine.run(specPath, targetPath);

console.log(JSON.stringify(results, null, 2));
```