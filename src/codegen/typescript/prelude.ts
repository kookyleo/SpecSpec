// SpecSpec TypeScript Prelude
// Validation primitives - embedded at top of generated validators

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

// === Types ===

export interface Issue {
  path: string;
  code: string;
  message: string;
}

export type Issues = Issue[];
export type Validator = (value: unknown, path: string[], issues: Issues) => void;
export type FSValidator = (ctx: FSContext, path: string[], issues: Issues) => void;

export interface ValidationResult {
  ok: boolean;
  issues: Issues;
}

function addIssue(issues: Issues, path: string[], code: string, message: string): void {
  issues.push({ path: path.length > 0 ? path.join('.') : '(root)', code, message });
}

// === Primitive validators ===

export function validateStr(
  value: unknown, path: string[], issues: Issues,
  opts?: { minLength?: number; maxLength?: number; pattern?: RegExp }
): void {
  if (typeof value !== 'string') {
    addIssue(issues, path, 'type.mismatch', `Expected string, got ${typeof value}`);
    return;
  }
  if (opts?.minLength !== undefined && value.length < opts.minLength) {
    addIssue(issues, path, 'str.too_short', `String length ${value.length} is less than minimum ${opts.minLength}`);
  }
  if (opts?.maxLength !== undefined && value.length > opts.maxLength) {
    addIssue(issues, path, 'str.too_long', `String length ${value.length} exceeds maximum ${opts.maxLength}`);
  }
  if (opts?.pattern !== undefined && !opts.pattern.test(value)) {
    addIssue(issues, path, 'str.pattern_mismatch', `String does not match pattern ${opts.pattern}`);
  }
}

export function validateNum(
  value: unknown, path: string[], issues: Issues,
  opts?: { min?: number; max?: number; integer?: boolean }
): void {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    addIssue(issues, path, 'type.mismatch', `Expected number, got ${typeof value}`);
    return;
  }
  if (opts?.integer && !Number.isInteger(value)) {
    addIssue(issues, path, 'num.not_integer', `Expected integer, got ${value}`);
  }
  if (opts?.min !== undefined && value < opts.min) {
    addIssue(issues, path, 'num.too_small', `Number ${value} is less than minimum ${opts.min}`);
  }
  if (opts?.max !== undefined && value > opts.max) {
    addIssue(issues, path, 'num.too_large', `Number ${value} exceeds maximum ${opts.max}`);
  }
}

export function validateBool(value: unknown, path: string[], issues: Issues): void {
  if (typeof value !== 'boolean') {
    addIssue(issues, path, 'type.mismatch', `Expected boolean, got ${typeof value}`);
  }
}

export function validateLiteral(value: unknown, path: string[], issues: Issues, expected: unknown): void {
  if (value !== expected) {
    addIssue(issues, path, 'literal.mismatch', `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
  }
}

export function validatePattern(value: unknown, path: string[], issues: Issues, pattern: RegExp): void {
  if (typeof value !== 'string') {
    addIssue(issues, path, 'type.mismatch', `Expected string for pattern match, got ${typeof value}`);
    return;
  }
  if (!pattern.test(value)) {
    addIssue(issues, path, 'pattern.mismatch', `Value does not match pattern ${pattern}`);
  }
}

// === Structural validators ===

export function validateObject(value: unknown, path: string[], issues: Issues): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    addIssue(issues, path, 'type.mismatch', `Expected object, got ${value === null ? 'null' : typeof value}`);
    return false;
  }
  return true;
}

export function validateField(
  obj: unknown, path: string[], issues: Issues,
  key: string, opts?: { validator?: Validator; optional?: boolean }
): void {
  if (typeof obj !== 'object' || obj === null) return;

  const record = obj as Record<string, unknown>;
  if (!(key in record)) {
    if (!opts?.optional) {
      addIssue(issues, path, 'field.missing', `Missing required field: ${key}`);
    }
    return;
  }

  if (opts?.validator) {
    opts.validator(record[key], [...path, key], issues);
  }
}

export function validateList(
  value: unknown, path: string[], issues: Issues,
  opts?: { itemValidator?: Validator; minItems?: number; maxItems?: number }
): void {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type.mismatch', `Expected array, got ${typeof value}`);
    return;
  }

  if (opts?.minItems !== undefined && value.length < opts.minItems) {
    addIssue(issues, path, 'list.too_short', `Array length ${value.length} is less than minimum ${opts.minItems}`);
  }
  if (opts?.maxItems !== undefined && value.length > opts.maxItems) {
    addIssue(issues, path, 'list.too_long', `Array length ${value.length} exceeds maximum ${opts.maxItems}`);
  }

  if (opts?.itemValidator) {
    value.forEach((item, i) => {
      opts.itemValidator!(item, [...path, `[${i}]`], issues);
    });
  }
}

export function validateOneOf(
  value: unknown, path: string[], issues: Issues,
  validators: Validator[]
): void {
  for (const validator of validators) {
    const testIssues: Issues = [];
    validator(value, path, testIssues);
    if (testIssues.length === 0) {
      return; // Matched
    }
  }
  addIssue(issues, path, 'oneof.no_match', 'Value does not match any of the options');
}

// === File system context ===

export class FSContext {
  private zipFile: AdmZip | null = null;

  constructor(public readonly basePath: string, public readonly isZip: boolean) {
    if (isZip) {
      this.zipFile = new AdmZip(basePath);
    }
  }

  exists(relPath: string): boolean {
    if (this.isZip) {
      return this.zipFile!.getEntry(relPath) !== null ||
             this.zipFile!.getEntry(relPath + '/') !== null;
    }
    return fs.existsSync(path.join(this.basePath, relPath));
  }

  isFile(relPath: string): boolean {
    if (this.isZip) {
      const entry = this.zipFile!.getEntry(relPath);
      return entry !== null && !entry.isDirectory;
    }
    const fullPath = path.join(this.basePath, relPath);
    try {
      return fs.statSync(fullPath).isFile();
    } catch {
      return false;
    }
  }

  isDir(relPath: string): boolean {
    if (this.isZip) {
      const entry = this.zipFile!.getEntry(relPath + '/');
      if (entry?.isDirectory) return true;
      // Check if any entries start with this path
      return this.zipFile!.getEntries().some((e: AdmZip.IZipEntry) => e.entryName.startsWith(relPath + '/'));
    }
    const fullPath = path.join(this.basePath, relPath);
    try {
      return fs.statSync(fullPath).isDirectory();
    } catch {
      return false;
    }
  }

  read(relPath: string): string {
    if (this.isZip) {
      const entry = this.zipFile!.getEntry(relPath);
      if (!entry) throw new Error(`File not found: ${relPath}`);
      return entry.getData().toString('utf-8');
    }
    return fs.readFileSync(path.join(this.basePath, relPath), 'utf-8');
  }

  readJson(relPath: string): unknown {
    return JSON.parse(this.read(relPath));
  }

  basename(): string {
    let name = path.basename(this.basePath);
    const dotIdx = name.lastIndexOf('.');
    if (dotIdx > 0) {
      name = name.substring(0, dotIdx);
    }
    return name;
  }
}

// === File system validators ===

export function validateBundle(
  bundlePath: string, pathList: string[], issues: Issues,
  opts: {
    acceptDir?: boolean;
    acceptZip?: boolean;
    zipExt?: string;
    namePattern?: RegExp;
    contentValidator?: FSValidator;
  }
): FSContext | null {
  let isDir = false;
  let isZip = false;

  try {
    const stat = fs.statSync(bundlePath);
    isDir = stat.isDirectory();
    isZip = stat.isFile() && bundlePath.endsWith('.zip');
  } catch {
    addIssue(issues, pathList, 'bundle.not_found', `Path not found: ${bundlePath}`);
    return null;
  }

  // Check zip extension
  if (isZip && opts.zipExt && !bundlePath.endsWith(`.${opts.zipExt}`)) {
    isZip = false;
  }

  if (isDir && !opts.acceptDir) {
    addIssue(issues, pathList, 'bundle.type_mismatch', 'Directory not accepted');
    return null;
  }
  if (isZip && !opts.acceptZip) {
    addIssue(issues, pathList, 'bundle.type_mismatch', 'Zip file not accepted');
    return null;
  }
  if (!isDir && !isZip) {
    addIssue(issues, pathList, 'bundle.invalid', `Not a valid bundle: ${bundlePath}`);
    return null;
  }

  const ctx = new FSContext(bundlePath, isZip);

  // Validate name pattern
  if (opts.namePattern) {
    const name = ctx.basename();
    if (!opts.namePattern.test(name)) {
      addIssue(issues, pathList, 'bundle.name_mismatch', `Name '${name}' does not match pattern`);
    }
  }

  // Validate content
  if (opts.contentValidator) {
    opts.contentValidator(ctx, pathList, issues);
  }

  return ctx;
}

export function validateJsonFile(
  ctx: FSContext, relPath: string, pathList: string[], issues: Issues,
  contentValidator?: Validator
): unknown | null {
  const filePath = [...pathList, relPath];

  if (!ctx.exists(relPath)) {
    addIssue(issues, filePath, 'file.not_found', `File not found: ${relPath}`);
    return null;
  }

  if (!ctx.isFile(relPath)) {
    addIssue(issues, filePath, 'file.not_file', `Not a file: ${relPath}`);
    return null;
  }

  let content: unknown;
  try {
    content = ctx.readJson(relPath);
  } catch (e) {
    addIssue(issues, filePath, 'json.parse_error', `Invalid JSON: ${(e as Error).message}`);
    return null;
  }

  if (contentValidator) {
    contentValidator(content, filePath, issues);
  }

  return content;
}

export function validateFsFile(
  ctx: FSContext, relPath: string, pathList: string[], issues: Issues,
  ext?: string
): boolean {
  const filePath = [...pathList, relPath];

  if (!ctx.exists(relPath)) {
    addIssue(issues, filePath, 'file.not_found', `File not found: ${relPath}`);
    return false;
  }

  if (!ctx.isFile(relPath)) {
    addIssue(issues, filePath, 'file.not_file', `Not a file: ${relPath}`);
    return false;
  }

  if (ext) {
    const actualExt = relPath.split('.').pop() ?? '';
    if (actualExt !== ext) {
      addIssue(issues, filePath, 'file.wrong_ext', `Expected .${ext}, got .${actualExt}`);
      return false;
    }
  }

  return true;
}

export function validateFsDirectory(
  ctx: FSContext, relPath: string, pathList: string[], issues: Issues
): boolean {
  const dirPath = [...pathList, relPath];

  if (!ctx.exists(relPath)) {
    addIssue(issues, dirPath, 'dir.not_found', `Directory not found: ${relPath}`);
    return false;
  }

  if (!ctx.isDir(relPath)) {
    addIssue(issues, dirPath, 'dir.not_dir', `Not a directory: ${relPath}`);
    return false;
  }

  return true;
}

// === Entry points ===

export function validate(value: unknown, validator: Validator): ValidationResult {
  const issues: Issues = [];
  validator(value, [], issues);
  return { ok: issues.length === 0, issues };
}

export function validatePath(
  bundlePath: string,
  validator: (path: string, pathList: string[], issues: Issues) => FSContext | null
): ValidationResult {
  const issues: Issues = [];
  validator(bundlePath, [], issues);
  return { ok: issues.length === 0, issues };
}
