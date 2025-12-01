# SpecSpec

A universal **Spec DSL Engine** for describing and validating software specifications using code-as-spec approach.

## Installation

```bash
npm install @specspec/core
```

## CLI Usage

```bash
# Create a sample spec file
specspec --init

# Validate a target against a spec
specspec my.spec.js ./my-project

# Show help
specspec --help
```

---

## Design Philosophy

SpecSpec implements an **Internal DSL** for software specification validation:

- **100% JavaScript syntax**: No new language to learn - specs are defined in `.js` files using functions and objects
- **Domain-specific semantics**: A highly customized vocabulary designed specifically for "describing and validating specifications"

---

## Core Concepts

The DSL is built on two fundamental concepts:

### 1. Type

Types represent validation targets. Each type has:
- A **value** it validates
- An optional **spec** that configures validation behavior

```javascript
// Type without spec - just validates the type
Str()
Num()
Bool()

// Type with spec - validates type AND constraints
Str({ minLength: 1, maxLength: 100 })
Num({ min: 0, max: 65535 })
```

### 2. Modifier

Modifiers are combinators that compose multiple types or values:

```javascript
// OneOf - value must match one option
OneOf('MIT', 'Apache-2.0', Str())

// ListOf - array of items matching a type
ListOf(Str(), { min: 1, max: 10 })
```

---

## Built-in Types

### Primitive Types

| Type | Description | Spec Options |
|------|-------------|--------------|
| `Str()` | String validation | `minLength`, `maxLength`, `match` (RegExp) |
| `Num()` | Number validation | `min`, `max`, `integer` |
| `Bool()` | Boolean validation | - |

### Structural Types

| Type | Description | Spec Options |
|------|-------------|--------------|
| `Field()` | JSON field | `key`, `value`, `optional` |
| `File()` | File on disk | `path`, `ext`, `content` |
| `Directory()` | Directory on disk | `path`, `content` |
| `JsonFile()` | JSON file | `path`, `required`, `optional` |

### Modifiers

| Modifier | Description | Options |
|----------|-------------|---------|
| `OneOf()` | Match one of options | Literals or Types |
| `ListOf()` | Array validation | `min`, `max` |

---

## Quick Start

### 1. Write a Spec File

```javascript
// my-package.spec.js

// Reusable definitions
const NameField = Field({ key: 'name', value: Str({ minLength: 1 }) });
const VersionField = Field({ key: 'version', value: Str({ match: /^\d+\.\d+\.\d+/ }) });

// Root spec
Directory({
  content: {
    required: [
      JsonFile({
        path: 'package.json',
        required: [NameField, VersionField],
        optional: [
          Field({ key: 'description', value: Str(), optional: true }),
          Field({ key: 'license', value: OneOf('MIT', 'Apache-2.0', Str()), optional: true })
        ]
      })
    ],
    optional: [
      File({ path: 'README.md' }),
      Directory({ path: 'src' })
    ]
  }
})
```

### 2. Run Validation

**Using CLI:**

```bash
specspec my-package.spec.js ./my-project
```

**Using API:**

```javascript
import { SpecEngine } from '@specspec/core';

const engine = new SpecEngine();
const result = engine.run('my-package.spec.js', '/path/to/project');

if (result.ok) {
  console.log('Validation passed!');
} else {
  for (const issue of result.issues) {
    console.log(`[${issue.level}] ${issue.code}: ${issue.message}`);
  }
}
```

---

## Custom Types

Register custom types with the engine:

```javascript
import { Type, SpecEngine } from '@specspec/core';

// Define custom type
class EmailType extends Type {
  validate(value, ctx) {
    if (typeof value !== 'string' || !value.includes('@')) {
      ctx.addIssue('email.invalid', 'Invalid email format');
    }
  }
}
const Email = () => new EmailType(undefined);

// Register with engine
const engine = new SpecEngine();
engine.register({ Email });

// Now Email() can be used in spec files
```

---

## Architecture

```
@specspec/core
├── base.ts        # Type, Modifier base classes
├── context.ts     # ValidationContext
├── engine.ts      # SpecEngine (VM sandbox)
├── types/
│   ├── primitives.ts   # Str, Bool, Num
│   └── structural.ts   # Field, File, Directory, JsonFile
└── modifiers/
    ├── oneof.ts   # OneOf
    └── listof.ts  # ListOf
```

---

## License

Apache-2.0
