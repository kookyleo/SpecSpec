// SpecSpec/src/assertions/is.mjs
// "Is" family assertions - for asserting state or type

import { Assertion } from './base.mjs';

export class IsOneOfAssertion extends Assertion {
  constructor(descriptors) {
    super();
    this.descriptors = descriptors;
  }

  execute(engine, context) {
    const passedOne = this.descriptors.some(descriptor => descriptor.execute(engine, context));
    if (!passedOne) {
      context.addIssue('target.is.oneof.fail', 'Target does not match any of the specified types.');
    }
  }
}

export class IsJSONAssertion extends Assertion {
  execute(engine, fileContext) {
    if (fileContext.json() === null) {
      fileContext.addIssue('file.not_json', 'File is not valid JSON.');
    }
  }
}

export class IsStringAssertion extends Assertion {
  execute(engine, context) {
    if (typeof context.value !== 'string') {
      context.addIssue('is.string.fail', 'Value is not a string.');
    }
  }
}

export class IsEmptyAssertion extends Assertion {
  execute(engine, context) {
    const subject = context.value !== undefined
      ? context.value
      : (context.content ? context.content() : null);

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
