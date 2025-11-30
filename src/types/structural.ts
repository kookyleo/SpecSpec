// src/types/structural.ts
// Structural types: Field, File, Directory

import fs from 'node:fs';
import path from 'node:path';
import { Type, validateAny, type Validatable, type ObjectSpec, isObjectSpec } from '../base.js';
import type { Context } from '../context.js';

// ═══════════════════════════════════════════════════════════════
// Field - JSON field type
// ═══════════════════════════════════════════════════════════════

export interface FieldSpec {
  key: string;
  value?: Validatable | ObjectSpec;
  optional?: boolean;
}

export class FieldType extends Type<FieldSpec, Record<string, unknown>> {
  validate(obj: unknown, ctx: Context): void {
    if (obj === null || typeof obj !== 'object') {
      ctx.addIssue('type.mismatch', `Expected object, got ${typeof obj}`);
      return;
    }

    const record = obj as Record<string, unknown>;
    const { key, value, optional } = this.spec;
    const fieldValue = record[key];

    if (fieldValue === undefined) {
      if (!optional) {
        ctx.addIssue('field.missing', `Missing required field: ${key}`);
      }
      return;
    }

    if (value !== undefined) {
      const childCtx = ctx.child(key, fieldValue);
      if (isObjectSpec(value)) {
        // Inline object spec: { required: [...], optional: [...] }
        for (const field of value.required ?? []) {
          validateAny(field, fieldValue, childCtx);
        }
        for (const field of value.optional ?? []) {
          validateAny(field, fieldValue, childCtx);
        }
      } else {
        validateAny(value, fieldValue, childCtx);
      }
    }
  }
}

export const Field = (spec: FieldSpec) => new FieldType(spec);

// ═══════════════════════════════════════════════════════════════
// File - File type
// ═══════════════════════════════════════════════════════════════

export interface FileSpec {
  path?: string;
  ext?: string;
  content?: Validatable | ObjectSpec;
}

export class FileType extends Type<FileSpec | undefined, string> {
  validate(basePath: unknown, ctx: Context): void {
    if (typeof basePath !== 'string') {
      ctx.addIssue('type.mismatch', `Expected path string, got ${typeof basePath}`);
      return;
    }

    const spec = this.spec;
    const filePath = spec?.path ? path.join(basePath, spec.path) : basePath;

    // Check file exists
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      ctx.addIssue('file.not_found', `File not found: ${filePath}`);
      return;
    }

    if (!stat.isFile()) {
      ctx.addIssue('file.not_file', `Not a file: ${filePath}`);
      return;
    }

    // Check extension
    if (spec?.ext) {
      const ext = path.extname(filePath).slice(1); // Remove leading dot
      if (ext !== spec.ext) {
        ctx.addIssue('file.wrong_ext', `Expected extension .${spec.ext}, got .${ext}`);
      }
    }

    // Validate content
    if (spec?.content) {
      const childCtx = ctx.child(spec.path ?? path.basename(filePath), null);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Try to parse as JSON if content validation is specified
        let parsedContent: unknown = content;
        try {
          parsedContent = JSON.parse(content);
        } catch {
          // Not JSON, use raw content
        }

        if (isObjectSpec(spec.content)) {
          for (const field of spec.content.required ?? []) {
            validateAny(field, parsedContent, childCtx);
          }
          for (const field of spec.content.optional ?? []) {
            validateAny(field, parsedContent, childCtx);
          }
        } else {
          validateAny(spec.content, parsedContent, childCtx);
        }
      } catch (err) {
        ctx.addIssue('file.read_error', `Failed to read file: ${(err as Error).message}`);
      }
    }
  }

  matches(basePath: unknown, _ctx: Context): boolean {
    if (typeof basePath !== 'string') return false;
    const filePath = this.spec?.path ? path.join(basePath, this.spec.path) : basePath;
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return false;
      if (this.spec?.ext) {
        const ext = path.extname(filePath).slice(1);
        if (ext !== this.spec.ext) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

const defaultFile = new FileType(undefined);
export const File = Object.assign(
  (spec?: FileSpec) => spec ? new FileType(spec) : defaultFile,
  { _default: defaultFile }
);

// ═══════════════════════════════════════════════════════════════
// Directory - Directory type
// ═══════════════════════════════════════════════════════════════

export interface DirectorySpec {
  path?: string;
  content?: Validatable | ObjectSpec;
}

export class DirectoryType extends Type<DirectorySpec | undefined, string> {
  validate(basePath: unknown, ctx: Context): void {
    if (typeof basePath !== 'string') {
      ctx.addIssue('type.mismatch', `Expected path string, got ${typeof basePath}`);
      return;
    }

    const spec = this.spec;
    const dirPath = spec?.path ? path.join(basePath, spec.path) : basePath;

    // Check directory exists
    let stat: fs.Stats;
    try {
      stat = fs.statSync(dirPath);
    } catch {
      ctx.addIssue('dir.not_found', `Directory not found: ${dirPath}`);
      return;
    }

    if (!stat.isDirectory()) {
      ctx.addIssue('dir.not_dir', `Not a directory: ${dirPath}`);
      return;
    }

    // Validate content (child items)
    if (spec?.content) {
      const childCtx = ctx.child(spec.path ?? path.basename(dirPath), dirPath);
      if (isObjectSpec(spec.content)) {
        // Required items must exist and validate
        for (const item of spec.content.required ?? []) {
          validateAny(item, dirPath, childCtx);
        }
        // Optional items only validated if they exist (match)
        for (const item of spec.content.optional ?? []) {
          if (item instanceof FileType || item instanceof DirectoryType) {
            // Only validate if the file/directory exists
            if (item.matches(dirPath, childCtx)) {
              validateAny(item, dirPath, childCtx);
            }
          } else {
            validateAny(item, dirPath, childCtx);
          }
        }
      } else {
        validateAny(spec.content, dirPath, childCtx);
      }
    }
  }

  matches(basePath: unknown, _ctx: Context): boolean {
    if (typeof basePath !== 'string') return false;
    const dirPath = this.spec?.path ? path.join(basePath, this.spec.path) : basePath;
    try {
      const stat = fs.statSync(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}

const defaultDirectory = new DirectoryType(undefined);
export const Directory = Object.assign(
  (spec?: DirectorySpec) => spec ? new DirectoryType(spec) : defaultDirectory,
  { _default: defaultDirectory }
);

// ═══════════════════════════════════════════════════════════════
// JsonFile - JSON file type (convenience wrapper)
// ═══════════════════════════════════════════════════════════════

export interface JsonFileSpec {
  path: string;
  required?: Validatable[];
  optional?: Validatable[];
}

export class JsonFileType extends Type<JsonFileSpec, string> {
  validate(basePath: unknown, ctx: Context): void {
    if (typeof basePath !== 'string') {
      ctx.addIssue('type.mismatch', `Expected path string, got ${typeof basePath}`);
      return;
    }

    const { path: filePath, required, optional } = this.spec;
    const fullPath = path.join(basePath, filePath);

    // Check file exists
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      ctx.addIssue('file.not_found', `File not found: ${fullPath}`);
      return;
    }

    if (!stat.isFile()) {
      ctx.addIssue('file.not_file', `Not a file: ${fullPath}`);
      return;
    }

    // Parse JSON
    let content: unknown;
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      content = JSON.parse(raw);
    } catch (err) {
      ctx.addIssue('json.parse_error', `Failed to parse JSON: ${(err as Error).message}`);
      return;
    }

    // Validate fields
    const childCtx = ctx.child(filePath, content);
    for (const field of required ?? []) {
      validateAny(field, content, childCtx);
    }
    for (const field of optional ?? []) {
      validateAny(field, content, childCtx);
    }
  }
}

export const JsonFile = (spec: JsonFileSpec) => new JsonFileType(spec);
