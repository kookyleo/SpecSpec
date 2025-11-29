// src/validators/directory.ts

import { BaseValidator } from './base.js';
import type { DirectoryDescriptor } from '../descriptors/directory.js';
import type { Engine, ExecutionContext, TargetContext } from '../types.js';

export class DirectoryValidator extends BaseValidator<DirectoryDescriptor> {
  validate(descriptor: DirectoryDescriptor, engine: Engine, context: ExecutionContext): void {
    if (!this.matches(descriptor, engine, context)) {
      context.addIssue('type.not_directory', 'Target is not a directory.');
    }
  }

  override matches(
    _descriptor: DirectoryDescriptor,
    _engine: Engine,
    context: ExecutionContext
  ): boolean {
    const targetContext = context as TargetContext;
    return targetContext.stat?.isDirectory() ?? false;
  }
}
