// src/validators/package.mjs
// Validator for PackageDescriptor

import { Validator } from './base.mjs';

export class PackageValidator extends Validator {
  validate(descriptor, engine, context) {
    const specFunc = descriptor.opts?.withSpec;
    if (specFunc && typeof specFunc === 'function') {
      const spec = engine.executeInContext(context, specFunc);
      if (spec && spec.rules) {
        for (const rule of spec.rules) {
          rule.execute(engine, context);
        }
      }
    }
  }
}
