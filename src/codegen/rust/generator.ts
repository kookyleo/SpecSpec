// src/codegen/rust/generator.ts
// Rust code generator implementation

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
 * Rust code generator
 */
export class RustGenerator extends CodeGenerator {
  readonly config: LanguageConfig = {
    name: 'rust',
    fileExt: '.rs',
    preludeFile: 'prelude.rs',
  };

  escapeString(s: string): string {
    // Rust string escaping
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
      const rawVal = desc.constraints?.[0]?.replace('equals ', '') ?? 'null';
      // Determine literal type
      if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
        const strVal = rawVal.replace(/^['"]|['"]$/g, '');
        return `|v, p, i| validate_literal_str(v, p, i, ${this.escapeString(strVal)})`;
      } else if (!isNaN(Number(rawVal))) {
        return `|v, p, i| validate_literal_i64(v, p, i, ${rawVal})`;
      }
      return `|v, p, i| {}`;
    }

    // Pattern
    if (name === 'Pattern') {
      const pattern = desc.constraints?.[0]?.replace('matches ', '').replace(/^`|`$/g, '') ?? '';
      return `|v, p, i| validate_pattern(v, p, i, ${this.escapeString(pattern)})`;
    }

    // String
    if (name === 'String') {
      const opts = extractStringConstraints(desc.constraints);
      const args: string[] = [];
      args.push(opts.minLength !== undefined ? `Some(${opts.minLength})` : 'None');
      args.push(opts.maxLength !== undefined ? `Some(${opts.maxLength})` : 'None');
      args.push(opts.pattern ? `Some(${this.escapeString(opts.pattern)})` : 'None');

      return `|v, p, i| validate_str(v, p, i, ${args.join(', ')})`;
    }

    // Number
    if (name === 'Number') {
      const opts = extractNumberConstraints(desc.constraints);
      const args: string[] = [];
      args.push(opts.min !== undefined ? `Some(${opts.min}_f64)` : 'None');
      args.push(opts.max !== undefined ? `Some(${opts.max}_f64)` : 'None');
      args.push(opts.integer ? 'true' : 'false');

      return `|v, p, i| validate_num(v, p, i, ${args.join(', ')})`;
    }

    // Boolean
    if (name === 'Boolean') {
      return '|v, p, i| validate_bool(v, p, i)';
    }

    // OneOf
    if (name === 'OneOf' && desc.oneOf) {
      const options = desc.oneOf.map(opt => `&(${this.generateDataValidatorExpr(opt)})`);
      return `|v, p, i| validate_oneof(v, p, i, &[${options.join(', ')}])`;
    }

    // ListOf
    if (name === 'ListOf' && desc.itemType) {
      const itemExpr = this.generateDataValidatorExpr(desc.itemType);
      const opts = extractListConstraints(desc.constraints);
      const args: string[] = [];
      args.push(`Some(&(${itemExpr}))`);
      args.push(opts.minItems !== undefined ? `Some(${opts.minItems})` : 'None');
      args.push(opts.maxItems !== undefined ? `Some(${opts.maxItems})` : 'None');
      return `|v, p, i| validate_list(v, p, i, ${args.join(', ')})`;
    }

    // Field
    if (name === 'Field' && desc.key) {
      const key = desc.key;
      const optional = desc.optional ?? false;

      let valueExpr: string | null = null;
      if (desc.oneOf) {
        const options = desc.oneOf.map(opt => `&(${this.generateDataValidatorExpr(opt)})`);
        valueExpr = `|v, p, i| validate_oneof(v, p, i, &[${options.join(', ')}])`;
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

      const validatorArg = valueExpr ? `Some(&(${valueExpr}))` : 'None';
      return `|v, p, i| validate_field(v, p, i, ${this.escapeString(key)}, ${validatorArg}, ${optional})`;
    }

    // Object with children
    if (name === 'Object' && desc.children) {
      return this.generateObjectExpr(desc.children);
    }

    // Unknown type
    return '|_, _, _| {}';
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
      return '|v, p, i| { validate_object(v, p, i); }';
    }

    const fieldCalls = fieldExprs.map(expr => `(${expr})(v, p, i)`).join('; ');
    return `|v, p, i| { if validate_object(v, p, i) { ${fieldCalls}; } }`;
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
      return '|_, _, _| {}';
    }

    return `|ctx, p, i| { ${parts.join('; ')}; }`;
  }

  generateFSChildExpr(desc: TypeDescription): string {
    const fsType = desc.fsType;
    const comment = desc.description ? `/* ${desc.description} */ ` : '';

    if (fsType === 'jsonFile' && desc.filePath) {
      const validatorArg = desc.children ? `Some(&(${this.generateObjectExpr(desc.children)}))` : 'None';
      return `${comment}validate_json_file(ctx, ${this.escapeString(desc.filePath)}, p, i, ${validatorArg})`;
    }

    if (fsType === 'file' && desc.filePath) {
      const ext = desc.fileExt ? `Some(${this.escapeString(desc.fileExt)})` : 'None';
      return `${comment}validate_fs_file(ctx, ${this.escapeString(desc.filePath)}, p, i, ${ext})`;
    }

    if (fsType === 'directory' && desc.filePath) {
      return `${comment}validate_fs_directory(ctx, ${this.escapeString(desc.filePath)}, p, i)`;
    }

    return '/* unknown fs type */';
  }

  generateBundleExpr(desc: TypeDescription): string {
    const accept = extractBundleAccept(desc.accept);
    const args: string[] = [];

    args.push(accept.acceptDir.toString());
    args.push(accept.acceptZip.toString());
    args.push(accept.zipExt ? `Some(${this.escapeString(accept.zipExt)})` : 'None');
    args.push(desc.namePattern ? `Some(${this.escapeString(desc.namePattern)})` : 'None');

    if (desc.children) {
      const contentExpr = this.generateBundleContentExpr(desc.children);
      args.push(`Some(&(${contentExpr}))`);
    } else {
      args.push('None');
    }

    return `|path, p, i| validate_bundle(path, p, i, ${args.join(', ')})`;
  }

  generateMainCode(isBundle: boolean): string {
    if (isBundle) {
      return `
pub fn validate_root(bundle_path: &str) -> ValidationResult {
    validate_path(bundle_path, &ROOT_VALIDATOR)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <bundle-path>", args[0]);
        std::process::exit(1);
    }

    let result = validate_root(&args[1]);
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
    std::process::exit(if result.ok { 0 } else { 1 });
}`;
    } else {
      return `
pub fn validate_root(value: &Value) -> ValidationResult {
    validate(value, &ROOT_VALIDATOR)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <json-file>", args[0]);
        std::process::exit(1);
    }

    let content = std::fs::read_to_string(&args[1]).expect("Cannot read file");
    let value: Value = serde_json::from_str(&content).expect("Invalid JSON");

    let result = validate_root(&value);
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
    std::process::exit(if result.ok { 0 } else { 1 });
}`;
    }
  }

  protected generateValidatorDecl(rootExpr: string, _isBundle: boolean): string {
    // Rust requires static/const declarations differently
    return `static ROOT_VALIDATOR: fn(&str, &[String], &mut Issues) -> Option<FSContext> = ${rootExpr};`;
  }

  protected commentLine(text: string): string {
    return `// ${text}`;
  }
}

/**
 * Generate Rust validator code from TypeDescription
 */
export function generateRust(desc: TypeDescription): string {
  const generator = new RustGenerator();
  return generator.generate(desc);
}
