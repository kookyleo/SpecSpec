// src/validators/file.ts

import fs from 'node:fs';
import path from 'node:path';
import { BaseValidator } from './base.js';
import type { FileDescriptor } from '../descriptors/file.js';
import type { Engine, ExecutionContext, TargetContext } from '../types.js';

export class FileValidator extends BaseValidator<FileDescriptor> {
  validate(descriptor: FileDescriptor, engine: Engine, context: ExecutionContext): void {
    const targetContext = context as TargetContext;
    const filePath = descriptor.opts.path;

    // If no path specified, this is a type-matching descriptor (for IsOneOf)
    if (!filePath) {
      if (!this.matches(descriptor, engine, context)) {
        const ext = descriptor.opts.withExtension ?? 'any';
        context.addIssue('type.not_file', `Target is not a file with extension: ${ext}`);
      }
      return;
    }

    const fileFullPath = path.join(targetContext.path, filePath);
    const fileExists = fs.existsSync(fileFullPath) && fs.statSync(fileFullPath).isFile();
    const specFunc = descriptor.opts.withSpec;

    if (!fileExists) {
      context.addIssue('file.missing', `File not found: '${filePath}'`);
      return;
    }

    if (specFunc && typeof specFunc === 'function') {
      const fileContext = targetContext.createFileContext(filePath);
      const spec = engine.executeInContext(fileContext, specFunc);
      if (spec && spec.rules) {
        for (const rule of spec.rules) {
          rule.execute(engine, fileContext);
        }
      }
    }
  }

  override matches(
    descriptor: FileDescriptor,
    _engine: Engine,
    context: ExecutionContext
  ): boolean {
    const targetContext = context as TargetContext;
    if (!targetContext.stat?.isFile()) {
      return false;
    }
    if (descriptor.opts.withExtension) {
      const ext = '.' + descriptor.opts.withExtension.replace(/^\./, '');
      if (!targetContext.path.endsWith(ext)) {
        return false;
      }
    }
    return true;
  }
}
