// src/validators/field.mjs
// Validator for FieldDescriptor

import { Validator } from './base.mjs';

export class FieldValidator extends Validator {
  validate(descriptor, engine, context) {
    const opts = descriptor.opts;
    const obj = context.json();

    if (obj === null) {
      if (opts.required) {
        context.addIssue('field.missing.parent',
          `Cannot check for field '${opts.key}' because parent is not a valid JSON object.`);
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
      const fieldContext = context.createFieldContext(fieldName, value);
      const spec = engine.executeInContext(fieldContext, opts.withSpec);
      if (spec && spec.rules) {
        for (const rule of spec.rules) {
          rule.execute(engine, fieldContext);
        }
      }
    }

    // Semantic type validation (e.g., is: 'semver')
    if (opts.is && engine.ruleFactories?.$.Is) {
      const isFactory = engine.ruleFactories.$.Is[opts.is];
      if (typeof isFactory === 'function') {
        const fieldContext = context.createFieldContext(fieldName, value);
        const assertion = isFactory();
        assertion.execute(engine, fieldContext);
      }
    }
  }
}
