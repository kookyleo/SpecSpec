// support/core-rules.mjs
// A library of generic, domain-agnostic assertion classes.

import fs from 'node:fs';
import path from 'node:path';

// --- Base and Logic Classes ---

export class Assertion {
  execute(engine, context) { throw new Error(`Assertion '${this.constructor.name}' must implement 'execute'.`); }
}

export class OrAssertion extends Assertion {
  constructor(a, b) { super(); this.a = a; this.b = b; }
  execute(engine, context) {
    const initialIssueCount = context.issues.length;
    this.a.execute(engine, context);
    if (context.issues.length > initialIssueCount) { // If A failed
      context.issues.splice(initialIssueCount); // Reset issues
      this.b.execute(engine, context); // Try B
    }
  }
}

// --- Container Classes ---

export class PackageAssertion extends Assertion {
    constructor(opts) { super(); this.opts = opts; }
    execute(engine, context) {
        const specFunc = this.opts.withSpec;
        if (specFunc && typeof specFunc === 'function') {
            const spec = specFunc();
            spec.execute(engine, context);
        }
    }
}

export class SpecAssertion extends Assertion {
    constructor(name, rules) { super(); this.name = name; this.rules = rules; } // 'rules' is now an array
    execute(engine, context) {
        // rules is already an array, no need for engine.executeInContext here
        for (const assertion of this.rules) { // Iterate directly
            assertion.execute(engine, context);
        }
    }
}

// --- Descriptors (for use with Is.OneOf) ---

export class DirectoryDescriptor {
    execute(context) { return context.stat && context.stat.isDirectory(); }
}

export class FileDescriptor {
    constructor(opts) { this.opts = opts; }
    execute(context) {
        if (!context.stat || !context.stat.isFile()) return false;
        if (this.opts?.withExtension) {
            const ext = '.' + this.opts.withExtension.replace(/^\./, '');
            if (!context.path.endsWith(ext)) return false;
        }
        return true;
    }
}

// --- Assertion Implementations ---

export class IsOneOfAssertion extends Assertion {
    constructor(descriptors) { super(); this.descriptors = descriptors; }
    execute(engine, context) {
        let passedOne = false;
        for (const descriptor of this.descriptors) {
            if (descriptor.execute(context)) {
                passedOne = true;
                break;
            }
        }
        if (!passedOne) {
            context.addIssue('target.is.oneof.fail', 'Target does not match any of the specified types.');
        }
    }
}

export class ContainsFileAssertion extends Assertion {
  constructor(opts) { super(); this.opts = opts; }
  execute(engine, packageContext) {
    const filePath = this.opts.path;
    const fileFullPath = path.join(packageContext.path, filePath);
    const fileExists = fs.existsSync(fileFullPath) && fs.statSync(fileFullPath).isFile();

    const subSpecFunc = this.opts.withSpec;
    if (!fileExists) {
        if (subSpecFunc) { // Assume required if a sub-spec is defined
            packageContext.addIssue('file.missing', `Required file not found: '${filePath}'`);
        }
        return;
    }

    if (subSpecFunc && typeof subSpecFunc === 'function') {
        const fileContext = packageContext.createFileContext(filePath);
        // Delegate execution of the sub-spec to the engine to handle context switching
        const subSpec = engine.executeInContext(fileContext, subSpecFunc);
        subSpec.execute(engine, fileContext);
    }
  }
}

export class IsJSONAssertion extends Assertion {
  execute(engine, fileContext) { if (fileContext.json() === null) fileContext.addIssue('file.not_json', 'File is not valid JSON.'); }
}

export class HasFieldAssertion extends Assertion {
  constructor(opts) { super(); this.opts = { required: false, ...opts }; }
  execute(engine, fileContext) {
    const obj = fileContext.json();
    if (obj === null) return; 

    const fieldName = this.opts.key;
    const value = obj[fieldName];
    const isPresent = fieldName in obj && value !== null && value !== undefined;

    if (!isPresent) {
      if (this.opts.required) fileContext.addIssue('field.missing', `Required field not found: '${fieldName}'`);
      return;
    }
    
    if (this.opts.required && typeof value === 'string' && value.trim() === '') {
        fileContext.addIssue('field.empty', `Required field '${fieldName}' must not be empty.`);
    }
  }
}
