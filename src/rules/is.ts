// src/rules/is.ts

import type { Rule, Engine, ExecutionContext, Descriptor, FileContext, FieldContext } from '../types.js';

/**
 * IsOneOfRule - Checks if the target matches one of the given descriptors.
 */
export class IsOneOfRule implements Rule {
  constructor(private readonly descriptors: Descriptor[]) {}

  execute(engine: Engine, context: ExecutionContext): void {
    const passedOne = this.descriptors.some((descriptor) => {
      const validator = engine.getValidator(descriptor);
      if (validator && typeof validator.matches === 'function') {
        return validator.matches(descriptor, engine, context);
      }
      return false;
    });

    if (!passedOne) {
      context.addIssue(
        'target.is.oneof.fail',
        'Target does not match any of the specified types.'
      );
    }
  }
}

/**
 * IsJSONRule - Checks if the file content is valid JSON.
 */
export class IsJSONRule implements Rule {
  execute(_engine: Engine, context: ExecutionContext): void {
    const fileContext = context as FileContext;
    if (typeof fileContext.json !== 'function' || fileContext.json() === null) {
      context.addIssue('file.not_json', 'File is not valid JSON.');
    }
  }
}

/**
 * IsStringRule - Checks if the value is a string.
 */
export class IsStringRule implements Rule {
  execute(_engine: Engine, context: ExecutionContext): void {
    const fieldContext = context as FieldContext;
    if (typeof fieldContext.value !== 'string') {
      context.addIssue('is.string.fail', 'Value is not a string.');
    }
  }
}

/**
 * IsEmptyRule - Checks if the value is empty.
 */
export class IsEmptyRule implements Rule {
  execute(_engine: Engine, context: ExecutionContext): void {
    let subject: unknown;

    if ('value' in context) {
      subject = (context as FieldContext).value;
    } else if ('content' in context && typeof (context as FileContext).content === 'function') {
      subject = (context as FileContext).content();
    } else {
      subject = null;
    }

    let isEmpty = false;
    if (subject === null || subject === undefined) {
      isEmpty = true;
    } else if (Array.isArray(subject)) {
      isEmpty = subject.length === 0;
    } else if (typeof subject === 'string') {
      isEmpty = subject.length === 0;
    } else if (typeof subject === 'object') {
      isEmpty = Object.keys(subject).length === 0;
    }

    if (!isEmpty) {
      context.addIssue('is.empty.fail', 'Subject is not empty.');
    }
  }
}
