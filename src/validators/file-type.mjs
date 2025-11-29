// src/validators/file-type.mjs
// Matcher for FileTypeDescriptor (used by IsOneOf)

import { Validator } from './base.mjs';

export class FileTypeMatcher extends Validator {
  // For IsOneOf: returns true/false instead of adding issues
  matches(descriptor, engine, context) {
    if (!context.stat || !context.stat.isFile()) return false;
    if (descriptor.opts?.withExtension) {
      const ext = '.' + descriptor.opts.withExtension.replace(/^\./, '');
      if (!context.path.endsWith(ext)) return false;
    }
    return true;
  }

  validate(descriptor, engine, context) {
    if (!this.matches(descriptor, engine, context)) {
      const ext = descriptor.opts?.withExtension || 'any';
      context.addIssue('type.not_file', `Target is not a file with extension: ${ext}`);
    }
  }
}
