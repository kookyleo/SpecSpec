// src/validators/package.ts

import { BaseValidator } from './base.js';
import type { PackageDescriptor } from '../descriptors/package.js';
import type { Engine, ExecutionContext } from '../types.js';

export class PackageValidator extends BaseValidator<PackageDescriptor> {
  validate(descriptor: PackageDescriptor, engine: Engine, context: ExecutionContext): void {
    const specFunc = descriptor.opts.withSpec;
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
