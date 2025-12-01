// src/codegen/python/generator.ts
// Python code generator implementation

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
 * Python code generator
 */
export class PythonGenerator extends CodeGenerator {
  readonly config: LanguageConfig = {
    name: 'python',
    fileExt: '.py',
    preludeFile: 'prelude.py',
  };

  escapeString(s: string): string {
    return JSON.stringify(s); // JSON escaping works for Python strings
  }

  loadPrelude(): string {
    const preludePath = path.join(__dirname, this.config.preludeFile);
    return fs.readFileSync(preludePath, 'utf-8');
  }

  generateDataValidatorExpr(desc: TypeDescription): string {
    const name = desc.name;

    // Literal value
    if (name === 'Literal') {
      const val = desc.constraints?.[0]?.replace('equals ', '') ?? 'None';
      return `lambda v, p, i: validate_literal(v, p, i, ${val})`;
    }

    // Pattern
    if (name === 'Pattern') {
      const pattern = desc.constraints?.[0]?.replace('matches ', '').replace(/^`|`$/g, '') ?? '';
      return `lambda v, p, i: validate_pattern(v, p, i, ${this.escapeString(pattern)})`;
    }

    // String
    if (name === 'String') {
      const opts = extractStringConstraints(desc.constraints);
      const args: string[] = [];
      if (opts.minLength !== undefined) args.push(`min_length=${opts.minLength}`);
      if (opts.maxLength !== undefined) args.push(`max_length=${opts.maxLength}`);
      if (opts.pattern) args.push(`pattern=${this.escapeString(opts.pattern)}`);

      if (args.length === 0) {
        return 'validate_str';
      }
      return `lambda v, p, i: validate_str(v, p, i, ${args.join(', ')})`;
    }

    // Number
    if (name === 'Number') {
      const opts = extractNumberConstraints(desc.constraints);
      const args: string[] = [];
      if (opts.integer) args.push('integer=True');
      if (opts.min !== undefined) args.push(`min_val=${opts.min}`);
      if (opts.max !== undefined) args.push(`max_val=${opts.max}`);

      if (args.length === 0) {
        return 'validate_num';
      }
      return `lambda v, p, i: validate_num(v, p, i, ${args.join(', ')})`;
    }

    // Boolean
    if (name === 'Boolean') {
      return 'validate_bool';
    }

    // OneOf
    if (name === 'OneOf' && desc.oneOf) {
      const options = desc.oneOf.map(opt => this.generateDataValidatorExpr(opt));
      return `lambda v, p, i: validate_oneof(v, p, i, [${options.join(', ')}])`;
    }

    // ListOf
    if (name === 'ListOf' && desc.itemType) {
      const itemExpr = this.generateDataValidatorExpr(desc.itemType);
      const opts = extractListConstraints(desc.constraints);
      const args: string[] = [`item_validator=${itemExpr}`];
      if (opts.minItems !== undefined) args.push(`min_items=${opts.minItems}`);
      if (opts.maxItems !== undefined) args.push(`max_items=${opts.maxItems}`);
      return `lambda v, p, i: validate_list(v, p, i, ${args.join(', ')})`;
    }

    // Field
    if (name === 'Field' && desc.key) {
      const key = desc.key;
      const optional = desc.optional ?? false;
      const args: string[] = [this.escapeString(key)];

      let valueExpr: string | null = null;
      if (desc.oneOf) {
        const options = desc.oneOf.map(opt => this.generateDataValidatorExpr(opt));
        valueExpr = `lambda v, p, i: validate_oneof(v, p, i, [${options.join(', ')}])`;
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
        args.push(`validator=${valueExpr}`);
      }
      if (optional) {
        args.push('optional=True');
      }
      return `lambda v, p, i: validate_field(v, p, i, ${args.join(', ')})`;
    }

    // Object with children
    if (name === 'Object' && desc.children) {
      return this.generateObjectExpr(desc.children);
    }

    // Unknown type
    return '(lambda v, p, i: None)';
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
      return 'validate_object';
    }

    const fieldCalls = fieldExprs.map(expr => `(${expr})(v, p, i)`).join(', ');
    return `lambda v, p, i: validate_object(v, p, i) and [${fieldCalls}]`;
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
      return 'lambda ctx, p, i: None';
    }

    const calls = parts.join(', ');
    return `lambda ctx, p, i: [${calls}]`;
  }

  generateFSChildExpr(desc: TypeDescription): string {
    const fsType = desc.fsType;

    if (fsType === 'jsonFile' && desc.filePath) {
      const contentExpr = desc.children ? this.generateObjectExpr(desc.children) : 'None';
      return `validate_json_file(ctx, ${this.escapeString(desc.filePath)}, p, i, content_validator=${contentExpr})`;
    }

    if (fsType === 'file' && desc.filePath) {
      const ext = desc.fileExt ? `, ext=${this.escapeString(desc.fileExt)}` : '';
      return `validate_fs_file(ctx, ${this.escapeString(desc.filePath)}, p, i${ext})`;
    }

    if (fsType === 'directory' && desc.filePath) {
      return `validate_fs_directory(ctx, ${this.escapeString(desc.filePath)}, p, i)`;
    }

    return 'None';
  }

  generateBundleExpr(desc: TypeDescription): string {
    const accept = extractBundleAccept(desc.accept);
    const args: string[] = [];

    args.push(`accept_dir=${accept.acceptDir ? 'True' : 'False'}`);
    args.push(`accept_zip=${accept.acceptZip ? 'True' : 'False'}`);
    if (accept.zipExt) {
      args.push(`zip_ext=${this.escapeString(accept.zipExt)}`);
    }

    if (desc.namePattern) {
      args.push(`name_pattern=${this.escapeString(desc.namePattern)}`);
    }

    if (desc.children) {
      const contentExpr = this.generateBundleContentExpr(desc.children);
      args.push(`content_validator=${contentExpr}`);
    }

    return `lambda path, p, i: validate_bundle(path, p, i, ${args.join(', ')})`;
  }

  generateMainCode(isBundle: boolean): string {
    if (isBundle) {
      return `
def validate_root(path: str) -> dict:
    """Validate a bundle (directory or zip file) against the schema."""
    return validate_path(path, _root_validator)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python validator.py <bundle-path>")
        sys.exit(1)

    result = validate_root(sys.argv[1])
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["ok"] else 1)`;
    } else {
      return `
def validate_root(value) -> dict:
    """Validate value against the generated schema."""
    return validate(value, _root_validator)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python validator.py <json-file>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        data = json.load(f)

    result = validate_root(data)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["ok"] else 1)`;
    }
  }

  protected generateValidatorDecl(rootExpr: string, _isBundle: boolean): string {
    return `_root_validator = ${rootExpr}`;
  }

  protected commentLine(text: string): string {
    return `# ${text}`;
  }
}

/**
 * Generate Python validator code from TypeDescription
 */
export function generatePython(desc: TypeDescription): string {
  const generator = new PythonGenerator();
  return generator.generate(desc);
}
