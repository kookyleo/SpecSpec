// SpecSpec/src/contexts/index.mjs
// Execution context classes

import fs from 'node:fs';
import path from 'node:path';

export class TargetExecutionContext {
  constructor(targetPath) {
    this.path = targetPath;
    this.stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
    this.issues = [];
  }

  addIssue(code, message, details = {}) {
    this.issues.push({ level: 'error', code, message, ...details });
  }

  createFileContext(relativePath) {
    return new FileExecutionContext(this, relativePath);
  }
}

export class FileExecutionContext {
  constructor(packageContext, relativePath) {
    this.packageContext = packageContext;
    this.filePath = relativePath;
    this.fullPath = path.join(packageContext.path, relativePath);
    this.stat = fs.existsSync(this.fullPath) ? fs.statSync(this.fullPath) : null;
    this._content = null;
    this._json = null;
    this._jsonParsed = false;
  }

  content() {
    if (this._content === null) {
      this._content = fs.readFileSync(this.fullPath, 'utf-8');
    }
    return this._content;
  }

  json() {
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

  addIssue(code, message) {
    this.packageContext.addIssue(code, message, { path: this.filePath });
  }

  createFieldContext(fieldName, fieldValue) {
    return new FieldContext(this, fieldName, fieldValue);
  }
}

export class FieldContext {
  constructor(fileContext, fieldName, fieldValue) {
    this.fileContext = fileContext;
    this.fieldName = fieldName;
    this.value = fieldValue;
  }

  addIssue(code, message) {
    this.fileContext.addIssue(code, message, {
      path: `${this.fileContext.filePath}#${this.fieldName}`
    });
  }
}
