// src/validators/field.ts

import { BaseValidator } from './base.js';
import type { FieldDescriptor } from '../descriptors/field.js';
import type { Engine, ExecutionContext, FileContext } from '../types.js';

export class FieldValidator extends BaseValidator<FieldDescriptor> {
  validate(descriptor: FieldDescriptor, engine: Engine, context: ExecutionContext): void {
    const fileContext = context as FileContext;
    const opts = descriptor.opts;
    const obj = fileContext.json() as Record<string, unknown> | null;

    if (obj === null) {
      if (opts.required) {
        context.addIssue(
          'field.missing.parent',
          `Cannot check for field '${opts.key}' because parent is not a valid JSON object.`
        );
      }
      return;
    }

    const fieldName = opts.key;
    const value = obj[fieldName];
    const isPresent = fieldName in obj && value !== null && value !== undefined;

    if (!isPresent) {
      if (opts.required) {
        context.addIssue('field.missing', `Required field not found: '${fieldName}'`);
      }
      return;
    }

    if (opts.required && typeof value === 'string' && value.trim() === '') {
      context.addIssue('field.empty', `Required field '${fieldName}' must not be empty.`);
    }

    // Nested spec validation
    if (opts.withSpec && typeof opts.withSpec === 'function') {
      const fieldContext = fileContext.createFieldContext(fieldName, value);
      const spec = engine.executeInContext(fieldContext, opts.withSpec);
      if (spec && spec.rules) {
        for (const rule of spec.rules) {
          rule.execute(engine, fieldContext);
        }
      }
    }

    // Semantic type validation (e.g., is: 'semver')
    const ruleFactories = engine.ruleFactories as {
      $?: { Is?: Record<string, () => { execute: (e: Engine, c: ExecutionContext) => void }> };
    };
    if (opts.is && ruleFactories.$?.Is) {
      const isFactory = ruleFactories.$.Is[opts.is];
      if (typeof isFactory === 'function') {
        const fieldContext = fileContext.createFieldContext(fieldName, value);
        const rule = isFactory();
        rule.execute(engine, fieldContext);
      }
    }
  }
}
