// src/contexts/field.ts

import type { FieldContext, FileContext } from '../types.js';

export class FieldExecutionContext implements FieldContext {
  public readonly fileContext: FileContext;
  public readonly fieldName: string;
  public readonly value: unknown;

  constructor(fileContext: FileContext, fieldName: string, fieldValue: unknown) {
    this.fileContext = fileContext;
    this.fieldName = fieldName;
    this.value = fieldValue;
  }

  addIssue(code: string, message: string): void {
    const filePath = this.fileContext.filePath;
    this.fileContext.packageContext.issues.push({
      level: 'error',
      code,
      message,
      path: `${filePath}#${this.fieldName}`,
    });
  }
}
