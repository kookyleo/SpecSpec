# SpecSpec

一个通用的 **Spec DSL 引擎**，用于用代码描述规范（code-as-spec / code-as-contract）。

当前仓库中 `Specs/Asks` 目录里的实现，就是基于这套引擎的一个具体业务示例（“Asks 包格式规范”）。

## 核心概念

- `ValidationEngine`：负责加载 `Spec.js`，在沙箱中执行 DSL，并驱动整棵断言树。
- `CoreRules`：一组与业务无关的基础断言与描述符，例如：
  - `PackageAssertion` / `SpecAssertion`
  - `IsOneOfAssertion` / `ContainsFileAssertion` / `IsJSONAssertion` / `HasFieldAssertion`
  - `DirectoryDescriptor` / `FileDescriptor`
- DSL 写法类似：

```js
// Spec.js
Package({
  withSpec: () => Spec('My Package Spec', [
    $.Is.OneOf([
      Directory(),
      File({ withExtension: 'zip' })
    ]),
    $.Contains.File({
      path: 'manifest.json',
      withSpec: () => Spec('Manifest Rules', [
        $.Is.JSON(),
        $.Has.Field({ key: 'name', required: true })
      ])
    })
  ])
});
```

## 在业务项目中的使用草案

```js
import { ValidationEngine, createCoreDsl } from '@kookyleo/specspec';
import * as MyDomainRules from './my-domain-rules.mjs';

const engine = new ValidationEngine();

// 注册通用 DSL + 业务扩展
const coreDsl = await createCoreDsl();
engine.registerRules({
  ...coreDsl,
  $: {
    ...coreDsl.$,
    // 业务自定义断言
    Is: {
      ...coreDsl.$.Is,
      NameMatching: (regex) => new MyDomainRules.IsNameMatchingAssertion(regex)
    }
  }
});

// 在某处执行
const results = engine.run('/path/to/Spec.js', '/path/to/target');
```

## 发布到 GitHub

在本地进入 `SpecSpec` 目录后，可执行类似命令完成初始化与推送：

```bash
git init
git remote add origin git@github.com:kookyleo/SpecSpec.git
git add .
git commit -m "Initial SpecSpec engine"
git push -u origin main
```

> 本助手在当前环境下无法直接访问你的 GitHub 远程，但目录结构和代码已经准备好，你在本机执行上述命令即可完成发布。

