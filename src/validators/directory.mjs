// src/validators/directory.mjs
// Matcher for DirectoryDescriptor (used by IsOneOf)

import { Validator } from './base.mjs';

export class DirectoryMatcher extends Validator {
  // For IsOneOf: returns true/false instead of adding issues
  matches(descriptor, engine, context) {
    return context.stat && context.stat.isDirectory();
  }

  validate(descriptor, engine, context) {
    if (!this.matches(descriptor, engine, context)) {
      context.addIssue('type.not_directory', 'Target is not a directory.');
    }
  }
}
