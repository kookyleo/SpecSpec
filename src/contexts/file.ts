// src/contexts/file.ts

import fs from 'node:fs';
import path from 'node:path';
import type { Stats } from 'node:fs';
import type { FileContext, TargetContext } from '../types.js';
import { FieldExecutionContext } from './field.js';

export class FileExecutionContext implements FileContext {
  public readonly packageContext: TargetContext;
  public readonly filePath: string;
  public readonly fullPath: string;
  public readonly stat: Stats | null;

  private _content: string | null = null;
  private _json: unknown | null = null;
  private _jsonParsed = false;

  constructor(packageContext: TargetContext, relativePath: string) {
    this.packageContext = packageContext;
    this.filePath = relativePath;
    this.fullPath = path.join(packageContext.path, relativePath);
    this.stat = fs.existsSync(this.fullPath) ? fs.statSync(this.fullPath) : null;
  }

  content(): string {
    if (this._content === null) {
      this._content = fs.readFileSync(this.fullPath, 'utf-8');
    }
    return this._content!;
  }

  json(): unknown | null {
    if (!this._jsonParsed) {
      try {
        this._json = JSON.parse(this.content());
      } catch {
        this._json = null;
      }
      this._jsonParsed = true;
    }
    return this._json;
  }

  addIssue(code: string, message: string): void {
    this.packageContext.issues.push({
      level: 'error',
      code,
      message,
      path: this.filePath,
    });
  }

  createFieldContext(fieldName: string, fieldValue: unknown): FieldExecutionContext {
    return new FieldExecutionContext(this, fieldName, fieldValue);
  }
}
