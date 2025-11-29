// src/contexts/target.ts

import fs from 'node:fs';
import type { Stats } from 'node:fs';
import type { TargetContext, Issue } from '../types.js';
import { FileExecutionContext } from './file.js';

export class TargetExecutionContext implements TargetContext {
  public readonly path: string;
  public readonly stat: Stats | null;
  public readonly issues: Issue[] = [];

  constructor(targetPath: string) {
    this.path = targetPath;
    this.stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
  }

  addIssue(code: string, message: string): void {
    this.issues.push({ level: 'error', code, message });
  }

  createFileContext(relativePath: string): FileExecutionContext {
    return new FileExecutionContext(this, relativePath);
  }
}
