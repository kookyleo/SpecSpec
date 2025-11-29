// src/validators/base.ts

import type { Validator, Descriptor, Engine, ExecutionContext } from '../types.js';

/**
 * Abstract base class for validators.
 * Subclasses must implement validate().
 * matches() is optional and defaults to false.
 */
export abstract class BaseValidator<D extends Descriptor = Descriptor>
  implements Validator<D>
{
  abstract validate(descriptor: D, engine: Engine, context: ExecutionContext): void;

  matches(_descriptor: D, _engine: Engine, _context: ExecutionContext): boolean {
    return false;
  }
}
