// src/codegen/typescript/generator.ts
// TypeScript code generator implementation

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
 * TypeScript code generator
 */
export class TypeScriptGenerator extends CodeGenerator {
  readonly config: LanguageConfig = {
    name: 'typescript',
    fileExt: '.ts',
    preludeFile: 'prelude.ts',
  };

  escapeString(s: string): string {
    return JSON.stringify(s);
  }

  loadPrelude(): string {
    const preludePath = path.join(__dirname, this.config.preludeFile);
    return fs.readFileSync(preludePath, 'utf-8');
  }

  generateDataValidatorExpr(desc: TypeDescription): string {
    const name = desc.name;

    // Literal value
    if (name === 'Literal') {
      const val = desc.constraints?.[0]?.replace('equals ', '') ?? 'null';
      return `(v, p, i) => validateLiteral(v, p, i, ${val})`;
    }

    // Pattern
    if (name === 'Pattern') {
      const pattern = desc.constraints?.[0]?.replace('matches ', '').replace(/^`|`$/g, '') ?? '';
      return `(v, p, i) => validatePattern(v, p, i, ${pattern})`;
    }

    // String
    if (name === 'String') {
      const opts = extractStringConstraints(desc.constraints);
      const args: string[] = [];
      if (opts.minLength !== undefined) args.push(`minLength: ${opts.minLength}`);
      if (opts.maxLength !== undefined) args.push(`maxLength: ${opts.maxLength}`);
      if (opts.pattern) args.push(`pattern: ${opts.pattern}`);

      if (args.length === 0) {
        return 'validateStr';
      }
      return `(v, p, i) => validateStr(v, p, i, { ${args.join(', ')} })`;
    }

    // Number
    if (name === 'Number') {
      const opts = extractNumberConstraints(desc.constraints);
      const args: string[] = [];
      if (opts.integer) args.push('integer: true');
      if (opts.min !== undefined) args.push(`min: ${opts.min}`);
      if (opts.max !== undefined) args.push(`max: ${opts.max}`);

      if (args.length === 0) {
        return 'validateNum';
      }
      return `(v, p, i) => validateNum(v, p, i, { ${args.join(', ')} })`;
    }

    // Boolean
    if (name === 'Boolean') {
      return 'validateBool';
    }

    // OneOf
    if (name === 'OneOf' && desc.oneOf) {
      const options = desc.oneOf.map(opt => this.generateDataValidatorExpr(opt));
      return `(v, p, i) => validateOneOf(v, p, i, [${options.join(', ')}])`;
    }

    // ListOf
    if (name === 'ListOf' && desc.itemType) {
      const itemExpr = this.generateDataValidatorExpr(desc.itemType);
      const opts = extractListConstraints(desc.constraints);
      const args: string[] = [`itemValidator: ${itemExpr}`];
      if (opts.minItems !== undefined) args.push(`minItems: ${opts.minItems}`);
      if (opts.maxItems !== undefined) args.push(`maxItems: ${opts.maxItems}`);
      return `(v, p, i) => validateList(v, p, i, { ${args.join(', ')} })`;
    }

    // Field
    if (name === 'Field' && desc.key) {
      const key = desc.key;
      const optional = desc.optional ?? false;
      const args: string[] = [];

      let valueExpr: string | null = null;
      if (desc.oneOf) {
        const options = desc.oneOf.map(opt => this.generateDataValidatorExpr(opt));
        valueExpr = `(v, p, i) => validateOneOf(v, p, i, [${options.join(', ')}])`;
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

      const argsStr = args.length > 0 ? `, { ${args.join(', ')} }` : '';
      return `(v, p, i) => validateField(v, p, i, ${this.escapeString(key)}${argsStr})`;
    }

    // Object with children
    if (name === 'Object' && desc.children) {
      return this.generateObjectExpr(desc.children);
    }

    // Unknown type
    return '(v, p, i) => {}';
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
      return 'validateObject';
    }

    const fieldCalls = fieldExprs.map(expr => `(${expr})(v, p, i)`).join(', ');
    return `(v, p, i) => { if (validateObject(v, p, i)) { ${fieldCalls}; } }`;
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
      return '(ctx: FSContext, p: string[], i: Issues) => {}';
    }

    return `(ctx: FSContext, p: string[], i: Issues) => { ${parts.join('; ')}; }`;
  }

  generateFSChildExpr(desc: TypeDescription): string {
    const fsType = desc.fsType;

    if (fsType === 'jsonFile' && desc.filePath) {
      const contentExpr = desc.children ? this.generateObjectExpr(desc.children) : 'undefined';
      return `validateJsonFile(ctx, ${this.escapeString(desc.filePath)}, p, i, ${contentExpr})`;
    }

    if (fsType === 'file' && desc.filePath) {
      const ext = desc.fileExt ? `, ${this.escapeString(desc.fileExt)}` : '';
      return `validateFsFile(ctx, ${this.escapeString(desc.filePath)}, p, i${ext})`;
    }

    if (fsType === 'directory' && desc.filePath) {
      return `validateFsDirectory(ctx, ${this.escapeString(desc.filePath)}, p, i)`;
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
      args.push(`namePattern: /${desc.namePattern}/`);
    }

    if (desc.children) {
      const contentExpr = this.generateBundleContentExpr(desc.children);
      args.push(`contentValidator: ${contentExpr}`);
    }

    return `(path: string, p: string[], i: Issues) => validateBundle(path, p, i, { ${args.join(', ')} })`;
  }

  generateMainCode(isBundle: boolean): string {
    if (isBundle) {
      return `
export function validateRoot(bundlePath: string): ValidationResult {
  return validatePath(bundlePath, _rootValidator);
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length >= 1) {
  const result = validateRoot(args[0]);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}`;
    } else {
      return `
export function validateRoot(value: unknown): ValidationResult {
  return validate(value, _rootValidator);
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length >= 1) {
  const data = JSON.parse(fs.readFileSync(args[0], 'utf-8'));
  const result = validateRoot(data);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}`;
    }
  }

  protected generateValidatorDecl(rootExpr: string, isBundle: boolean): string {
    if (isBundle) {
      return `const _rootValidator = ${rootExpr};`;
    } else {
      return `const _rootValidator: Validator = ${rootExpr};`;
    }
  }

  protected commentLine(text: string): string {
    return `// ${text}`;
  }
}

/**
 * Generate TypeScript validator code from TypeDescription
 */
export function generateTypeScript(desc: TypeDescription): string {
  const generator = new TypeScriptGenerator();
  return generator.generate(desc);
}
