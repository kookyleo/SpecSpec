// src/types/structural.ts
// Structural types: Field, File, Directory

import fs from 'node:fs';
import path from 'node:path';
import { Type, Modifier, validateAny, type Validatable, type ObjectSpec, type TypeDescription, isObjectSpec, isType, isModifier, isLiteralValue } from '../base.js';
import type { Context } from '../context.js';

// Helper to describe any Validatable
function describeValidatable(v: Validatable | ObjectSpec): TypeDescription {
  if (isType(v)) {
    return v.describe();
  } else if (isModifier(v)) {
    return (v as Modifier).describe();
  } else if (isLiteralValue(v)) {
    if (v instanceof RegExp) {
      return { name: 'Pattern', constraints: [`matches \`${v}\``] };
    }
    return { name: 'Literal', constraints: [`equals ${JSON.stringify(v)}`] };
  } else if (isObjectSpec(v)) {
    return {
      name: 'Object',
      children: {
        required: v.required?.map(describeValidatable),
        optional: v.optional?.map(describeValidatable),
      },
    };
  }
  return { name: 'Unknown' };
}

// ═══════════════════════════════════════════════════════════════
// Field - JSON field type
// ═══════════════════════════════════════════════════════════════

export interface FieldSpec {
  /** Human-readable description */
  description?: string;
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

  describe(): TypeDescription {
    const { description, key, value, optional } = this.spec;
    const desc: TypeDescription = {
      name: 'Field',
      key,
      description,
      optional,
    };

    if (value !== undefined) {
      const valueDesc = describeValidatable(value);
      // Merge value description into field description
      desc.summary = valueDesc.name;
      desc.constraints = valueDesc.constraints;
      desc.children = valueDesc.children;
      desc.oneOf = valueDesc.oneOf;
      desc.itemType = valueDesc.itemType;
    }

    return desc;
  }
}

export const Field = (spec: FieldSpec) => new FieldType(spec);

// ═══════════════════════════════════════════════════════════════
// File - File type
// ═══════════════════════════════════════════════════════════════

export interface FileSpec {
  /** Human-readable description */
  description?: string;
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

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.ext) {
      constraints.push(`extension: .${this.spec.ext}`);
    }
    const desc: TypeDescription = {
      name: 'File',
      fsType: 'file',
      key: this.spec?.path,
      description: this.spec?.description,
      filePath: this.spec?.path,
      fileExt: this.spec?.ext,
      constraints: constraints.length > 0 ? constraints : undefined,
    };
    if (this.spec?.content) {
      const contentDesc = describeValidatable(this.spec.content);
      desc.children = contentDesc.children ?? { required: [contentDesc] };
    }
    return desc;
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
  /** Human-readable description */
  description?: string;
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

  describe(): TypeDescription {
    const desc: TypeDescription = {
      name: 'Directory',
      fsType: 'directory',
      key: this.spec?.path,
      description: this.spec?.description,
      filePath: this.spec?.path,
    };
    if (this.spec?.content) {
      if (isObjectSpec(this.spec.content)) {
        desc.children = {
          required: this.spec.content.required?.map(describeValidatable),
          optional: this.spec.content.optional?.map(describeValidatable),
        };
      } else {
        const contentDesc = describeValidatable(this.spec.content);
        desc.children = { required: [contentDesc] };
      }
    }
    return desc;
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
  /** Human-readable description */
  description?: string;
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

  describe(): TypeDescription {
    return {
      name: 'JsonFile',
      fsType: 'jsonFile',
      key: this.spec.path,
      description: this.spec.description,
      filePath: this.spec.path,
      children: {
        required: this.spec.required?.map(describeValidatable),
        optional: this.spec.optional?.map(describeValidatable),
      },
    };
  }
}

export const JsonFile = (spec: JsonFileSpec) => new JsonFileType(spec);
