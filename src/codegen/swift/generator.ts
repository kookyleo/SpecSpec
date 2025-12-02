// src/codegen/swift/generator.ts
// Swift code generator implementation

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TypeDescription } from '../../base.js';
import {
  CodeGenerator,
  type LanguageConfig,
  extractStringConstraints,
  extractNumberConstraints,
  extractListConstraints,
  extractBundleAccept,
} from '../base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Swift code generator
 */
export class SwiftGenerator extends CodeGenerator {
  readonly config: LanguageConfig = {
    name: 'swift',
    fileExt: '.swift',
    preludeFile: 'prelude.swift',
  };

  escapeString(s: string): string {
    // Swift string escaping
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }

  loadPrelude(): string {
    const preludePath = path.join(__dirname, this.config.preludeFile);
    return fs.readFileSync(preludePath, 'utf-8');
  }

  generateDataValidatorExpr(desc: TypeDescription): string {
    const name = desc.name;

    // Literal value
    if (name === 'Literal') {
      const val = desc.constraints?.[0]?.replace('equals ', '') ?? 'nil';
      // Swift literal needs proper type handling
      return `{ v, p, i in validateLiteral(v, p, &i, ${val}) }`;
    }

    // Pattern
    if (name === 'Pattern') {
      const pattern = desc.constraints?.[0]?.replace('matches ', '').replace(/^`|`$/g, '') ?? '';
      return `{ v, p, i in validatePattern(v, p, &i, ${this.escapeString(pattern)}) }`;
    }

    // String
    if (name === 'String') {
      const opts = extractStringConstraints(desc.constraints);
      const args: string[] = [];
      if (opts.minLength !== undefined) args.push(`minLength: ${opts.minLength}`);
      if (opts.maxLength !== undefined) args.push(`maxLength: ${opts.maxLength}`);
      if (opts.pattern) args.push(`pattern: ${this.escapeString(opts.pattern)}`);

      if (args.length === 0) {
        return '{ v, p, i in validateStr(v, p, &i) }';
      }
      return `{ v, p, i in validateStr(v, p, &i, ${args.join(', ')}) }`;
    }

    // Number
    if (name === 'Number') {
      const opts = extractNumberConstraints(desc.constraints);
      const args: string[] = [];
      if (opts.integer) args.push('integer: true');
      if (opts.min !== undefined) args.push(`min: ${opts.min}`);
      if (opts.max !== undefined) args.push(`max: ${opts.max}`);

      if (args.length === 0) {
        return '{ v, p, i in validateNum(v, p, &i) }';
      }
      return `{ v, p, i in validateNum(v, p, &i, ${args.join(', ')}) }`;
    }

    // Boolean
    if (name === 'Boolean') {
      return '{ v, p, i in validateBool(v, p, &i) }';
    }

    // OneOf
    if (name === 'OneOf' && desc.oneOf) {
      const options = desc.oneOf.map(opt => this.generateDataValidatorExpr(opt));
      return `{ v, p, i in validateOneOf(v, p, &i, [${options.join(', ')}]) }`;
    }

    // ListOf
    if (name === 'ListOf' && desc.itemType) {
      const itemExpr = this.generateDataValidatorExpr(desc.itemType);
      const opts = extractListConstraints(desc.constraints);
      const args: string[] = [`itemValidator: ${itemExpr}`];
      if (opts.minItems !== undefined) args.push(`minItems: ${opts.minItems}`);
      if (opts.maxItems !== undefined) args.push(`maxItems: ${opts.maxItems}`);
      return `{ v, p, i in validateList(v, p, &i, ${args.join(', ')}) }`;
    }

    // Field
    if (name === 'Field' && desc.key) {
      const key = desc.key;
      const optional = desc.optional ?? false;
      const args: string[] = [this.escapeString(key)];

      let valueExpr: string | null = null;
      if (desc.oneOf) {
        const options = desc.oneOf.map(opt => this.generateDataValidatorExpr(opt));
        valueExpr = `{ v, p, i in validateOneOf(v, p, &i, [${options.join(', ')}]) }`;
      } else if (desc.itemType) {
        valueExpr = this.generateDataValidatorExpr({
          name: 'ListOf',
          itemType: desc.itemType,
          constraints: desc.constraints,
        });
      } else if (desc.children) {
        valueExpr = this.generateObjectExpr(desc.children);
      } else if (desc.summary) {
        valueExpr = this.generateDataValidatorExpr({
          name: desc.summary,
          constraints: desc.constraints,
        });
      }

      if (valueExpr) {
        args.push(`validator: ${valueExpr}`);
      }
      if (optional) {
        args.push('optional: true');
      }

      return `{ v, p, i in validateField(v, p, &i, ${args.join(', ')}) }`;
    }

    // Object with children
    if (name === 'Object' && desc.children) {
      return this.generateObjectExpr(desc.children);
    }

    // Unknown type
    return '{ _, _, _ in }';
  }

  generateObjectExpr(
    children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
  ): string {
    const fieldExprs: string[] = [];

    for (const child of children.required ?? []) {
      fieldExprs.push(this.generateDataValidatorExpr(child));
    }
    for (const child of children.optional ?? []) {
      fieldExprs.push(this.generateDataValidatorExpr({ ...child, optional: true }));
    }

    if (fieldExprs.length === 0) {
      return '{ v, p, i in _ = validateObject(v, p, &i) }';
    }

    const fieldCalls = fieldExprs.map(expr => `(${expr})(v, p, &i)`).join('; ');
    return `{ v, p, i in if validateObject(v, p, &i) { ${fieldCalls} } }`;
  }

  generateBundleContentExpr(
    children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
  ): string {
    const parts: string[] = [];

    for (const child of children.required ?? []) {
      parts.push(this.generateFSChildExpr(child));
    }
    for (const child of children.optional ?? []) {
      parts.push(this.generateFSChildExpr(child));
    }

    if (parts.length === 0) {
      return '{ _, _, _ in }';
    }

    return `{ ctx, p, i in ${parts.join('; ')} }`;
  }

  generateFSChildExpr(desc: TypeDescription): string {
    const fsType = desc.fsType;
    const comment = desc.description ? `/* ${desc.description} */ ` : '';

    if (fsType === 'jsonFile' && desc.filePath) {
      const contentExpr = desc.children ? this.generateObjectExpr(desc.children) : 'nil';
      return `${comment}_ = validateJsonFile(ctx, ${this.escapeString(desc.filePath)}, p, &i, contentValidator: ${contentExpr})`;
    }

    if (fsType === 'file' && desc.filePath) {
      const ext = desc.fileExt ? `, ext: ${this.escapeString(desc.fileExt)}` : '';
      return `${comment}_ = validateFsFile(ctx, ${this.escapeString(desc.filePath)}, p, &i${ext})`;
    }

    if (fsType === 'directory' && desc.filePath) {
      return `${comment}_ = validateFsDirectory(ctx, ${this.escapeString(desc.filePath)}, p, &i)`;
    }

    return '/* unknown fs type */';
  }

  generateBundleExpr(desc: TypeDescription): string {
    const accept = extractBundleAccept(desc.accept);
    const args: string[] = [];

    args.push(`acceptDir: ${accept.acceptDir}`);
    args.push(`acceptZip: ${accept.acceptZip}`);
    if (accept.zipExt) {
      args.push(`zipExt: ${this.escapeString(accept.zipExt)}`);
    }

    if (desc.namePattern) {
      args.push(`namePattern: ${this.escapeString(desc.namePattern)}`);
    }

    if (desc.children) {
      const contentExpr = this.generateBundleContentExpr(desc.children);
      args.push(`contentValidator: ${contentExpr}`);
    }

    return `{ path, p, i in validateBundle(path, p, &i, ${args.join(', ')}) }`;
  }

  generateMainCode(isBundle: boolean): string {
    if (isBundle) {
      return `
public func validateRoot(_ bundlePath: String) -> ValidationResult {
    return validatePath(bundlePath, rootValidator)
}

// CLI entry point
#if os(macOS) || os(Linux)
if CommandLine.arguments.count >= 2 {
    let result = validateRoot(CommandLine.arguments[1])
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    if let data = try? encoder.encode(result), let json = String(data: data, encoding: .utf8) {
        print(json)
    }
    exit(result.ok ? 0 : 1)
}
#endif`;
    } else {
      return `
public func validateRoot(_ value: Any) -> ValidationResult {
    return validate(value, rootValidator)
}

// CLI entry point
#if os(macOS) || os(Linux)
if CommandLine.arguments.count >= 2 {
    let path = CommandLine.arguments[1]
    guard let data = FileManager.default.contents(atPath: path),
          let json = try? JSONSerialization.jsonObject(with: data) else {
        print("Error: Cannot read JSON file")
        exit(1)
    }
    let result = validateRoot(json)
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    if let resultData = try? encoder.encode(result), let output = String(data: resultData, encoding: .utf8) {
        print(output)
    }
    exit(result.ok ? 0 : 1)
}
#endif`;
    }
  }

  protected generateValidatorDecl(rootExpr: string, _isBundle: boolean): string {
    return `let rootValidator: (String, [String], inout Issues) -> FSContext? = ${rootExpr}`;
  }

  protected commentLine(text: string): string {
    return `// ${text}`;
  }
}

/**
 * Generate Swift validator code from TypeDescription
 */
export function generateSwift(desc: TypeDescription): string {
  const generator = new SwiftGenerator();
  return generator.generate(desc);
}
