// src/codegen/base.ts
// Abstract base class for code generators

import type { TypeDescription } from '../base.js';

/**
 * Language configuration for code generation
 */
export interface LanguageConfig {
  name: string;
  fileExt: string;
  preludeFile: string;
}

/**
 * Parse constraint string to extract values
 */
export function parseConstraint(constraint: string, prefix: string): string | null {
  if (constraint.startsWith(prefix)) {
    return constraint.slice(prefix.length).trim();
  }
  return null;
}

/**
 * Extract string constraints from TypeDescription
 */
export function extractStringConstraints(constraints: string[] | undefined): {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
} {
  const result: { minLength?: number; maxLength?: number; pattern?: string } = {};

  for (const c of constraints ?? []) {
    let val: string | null;
    if ((val = parseConstraint(c, 'minimum ')) && c.includes('character')) {
      result.minLength = parseInt(val.split(' ')[0]!, 10);
    } else if ((val = parseConstraint(c, 'maximum ')) && c.includes('character')) {
      result.maxLength = parseInt(val.split(' ')[0]!, 10);
    } else if ((val = parseConstraint(c, 'matches '))) {
      result.pattern = val.replace(/^`|`$/g, '');
    }
  }

  return result;
}

/**
 * Extract number constraints from TypeDescription
 */
export function extractNumberConstraints(constraints: string[] | undefined): {
  min?: number;
  max?: number;
  integer?: boolean;
} {
  const result: { min?: number; max?: number; integer?: boolean } = {};

  for (const c of constraints ?? []) {
    let val: string | null;
    if (c === 'integer') {
      result.integer = true;
    } else if ((val = parseConstraint(c, 'minimum '))) {
      result.min = parseFloat(val);
    } else if ((val = parseConstraint(c, 'maximum '))) {
      result.max = parseFloat(val);
    }
  }

  return result;
}

/**
 * Extract list constraints from TypeDescription
 */
export function extractListConstraints(constraints: string[] | undefined): {
  minItems?: number;
  maxItems?: number;
} {
  const result: { minItems?: number; maxItems?: number } = {};

  for (const c of constraints ?? []) {
    let val: string | null;
    if ((val = parseConstraint(c, 'minimum ')) && c.includes('items')) {
      result.minItems = parseInt(val.split(' ')[0]!, 10);
    } else if ((val = parseConstraint(c, 'maximum ')) && c.includes('items')) {
      result.maxItems = parseInt(val.split(' ')[0]!, 10);
    }
  }

  return result;
}

/**
 * Extract bundle accept types from TypeDescription
 */
export function extractBundleAccept(accept: TypeDescription[] | undefined): {
  acceptDir: boolean;
  acceptZip: boolean;
  zipExt: string | undefined;
} {
  let acceptDir = false;
  let acceptZip = false;
  let zipExt: string | undefined;

  for (const acc of accept ?? []) {
    if (acc.fsType === 'directory' || acc.name === 'Directory') {
      acceptDir = true;
    }
    if (acc.fsType === 'zipFile' || acc.name === 'ZipFile') {
      acceptZip = true;
      zipExt = acc.fileExt;
    }
  }

  return { acceptDir, acceptZip, zipExt };
}

/**
 * Abstract code generator base class
 */
export abstract class CodeGenerator {
  abstract readonly config: LanguageConfig;

  /**
   * Escape string for target language
   */
  abstract escapeString(s: string): string;

  /**
   * Generate validator expression for a data type
   */
  abstract generateDataValidatorExpr(desc: TypeDescription): string;

  /**
   * Generate object validator expression
   */
  abstract generateObjectExpr(
    children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
  ): string;

  /**
   * Generate bundle validator expression
   */
  abstract generateBundleExpr(desc: TypeDescription): string;

  /**
   * Generate bundle content validator expression
   */
  abstract generateBundleContentExpr(
    children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
  ): string;

  /**
   * Generate file system child validator expression
   */
  abstract generateFSChildExpr(desc: TypeDescription): string;

  /**
   * Load prelude content
   */
  abstract loadPrelude(): string;

  /**
   * Generate main entry point code
   */
  abstract generateMainCode(isBundle: boolean): string;

  /**
   * Generate complete validator code
   */
  generate(desc: TypeDescription): string {
    const prelude = this.loadPrelude();
    const isBundle = desc.fsType === 'bundle';

    const rootExpr = isBundle
      ? this.generateBundleExpr(desc)
      : this.generateDataValidatorExpr(desc);

    const mainCode = this.generateMainCode(isBundle);
    const validatorDecl = this.generateValidatorDecl(rootExpr, isBundle);

    const lines: string[] = [
      prelude,
      '',
      this.commentLine('='.repeat(60)),
      this.commentLine('Generated Schema'),
    ];

    // Add root description as comment if available
    if (desc.description) {
      lines.push(this.commentLine(''));
      for (const line of desc.description.split('\n')) {
        lines.push(this.commentLine(line));
      }
    }

    lines.push(this.commentLine('='.repeat(60)));
    lines.push('');
    lines.push(validatorDecl);
    lines.push(mainCode);

    return lines.join('\n');
  }

  /**
   * Generate validator declaration
   */
  protected abstract generateValidatorDecl(rootExpr: string, isBundle: boolean): string;

  /**
   * Generate a comment line
   */
  protected abstract commentLine(text: string): string;
}
