// src/validators/file.mjs
// Validator for FileDescriptor

import fs from 'node:fs';
import path from 'node:path';
import { Validator } from './base.mjs';

export class FileValidator extends Validator {
  validate(descriptor, engine, context) {
    const filePath = descriptor.opts.path;
    const fileFullPath = path.join(context.path, filePath);
    const fileExists = fs.existsSync(fileFullPath) && fs.statSync(fileFullPath).isFile();
    const specFunc = descriptor.opts.withSpec;

    if (!fileExists) {
      context.addIssue('file.missing', `File not found: '${filePath}'`);
      return;
    }

    if (specFunc && typeof specFunc === 'function') {
      const fileContext = context.createFileContext(filePath);
      const spec = engine.executeInContext(fileContext, specFunc);
      if (spec && spec.rules) {
        for (const rule of spec.rules) {
          rule.execute(engine, fileContext);
        }
      }
    }
  }
}
