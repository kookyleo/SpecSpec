// SpecSpec/src/core-rules.mjs
// The complete "standard library" of generic, domain-agnostic assertion classes.
// This version implements the generalized `Contains(Descriptor)` model.

import fs from 'node:fs';
import path from 'node:path';

// --- Base and Logic Classes ---

export class Assertion {
  execute(engine, context) { throw new Error(`Assertion '${this.constructor.name}' must implement 'execute'.`); }
}

// Helper to find the underlying issues array for any context shape
function getIssueArray(context) {
    if (context && Array.isArray(context.issues)) return context.issues;
    if (context && context.packageContext && Array.isArray(context.packageContext.issues)) {
        return context.packageContext.issues;
    }
    if (context && context.fileContext && context.fileContext.packageContext &&
        Array.isArray(context.fileContext.packageContext.issues)) {
        return context.fileContext.packageContext.issues;
    }
    return null;
}

export class NotAssertion extends Assertion {
    constructor(assertion) { super(); this.assertion = assertion; }
    execute(engine, context) {
        const issues = getIssueArray(context);
        if (!issues) {
            // Fallback: if we cannot track issues precisely, just run the assertion
            // and do nothing; safer than crashing.
            this.assertion.execute(engine, context);
            return;
        }
        const initialIssueCount = issues.length;
        this.assertion.execute(engine, context);
        const newIssues = issues.splice(initialIssueCount);
        if (newIssues.length === 0) {
            context.addIssue('logic.not.fail', `Assertion violated: ${this.assertion.constructor.name} was expected to fail but passed.`);
        }
    }
}

// Rule container: purely a named collection of assertions
export class SpecAssertion extends Assertion {
    constructor(name, rules) { super(); this.name = name; this.rules = rules; }
    execute(engine, context) {
        for (const assertion of this.rules) {
            assertion.execute(engine, context);
        }
    }
}

// Package descriptor: a common descriptor that says
// "this target must satisfy the rules in withSpec()".
// It is not a container itself; it delegates to a Spec.
export class PackageAssertion extends Assertion {
    constructor(opts) { super(); this.opts = opts; }
    execute(engine, context) {
        const specFunc = this.opts && this.opts.withSpec;
        if (specFunc && typeof specFunc === 'function') {
            const spec = specFunc();
            if (spec && typeof spec.execute === 'function') {
                spec.execute(engine, context);
            }
        }
    }
}

// --- Descriptors ---

// Type Descriptors (for $.Is.OneOf)
export class DirectoryDescriptor {
    execute(engine, context) { return context.stat && context.stat.isDirectory(); }
}
export class FileTypeDescriptor { // Renamed from FileDescriptor to avoid confusion
    constructor(opts) { this.opts = opts; }
    execute(engine, context) {
        if (!context.stat || !context.stat.isFile()) return false;
        if (this.opts?.withExtension) {
            const ext = '.' + this.opts.withExtension.replace(/^\./, '');
            if (!context.path.endsWith(ext)) return false;
        }
        return true;
    }
}

// Containment Descriptors (for $.Contains)
export class FileDescriptor extends Assertion {
    constructor(opts) { super(); this.opts = opts; }
    execute(engine, packageContext) { // This is now an assertion itself
        const filePath = this.opts.path;
        const fileFullPath = path.join(packageContext.path, filePath);
        const fileExists = fs.existsSync(fileFullPath) && fs.statSync(fileFullPath).isFile();
        const subSpecFunc = this.opts.withSpec;

        if (!fileExists) {
            if (subSpecFunc) packageContext.addIssue('file.missing', `Required file not found: '${filePath}'`);
            return;
        }

        if (subSpecFunc && typeof subSpecFunc === 'function') {
            const fileContext = packageContext.createFileContext(filePath);
            const subSpec = engine.executeInContext(fileContext, subSpecFunc);
            subSpec.execute(engine, fileContext);
        }
    }
}

export class FieldDescriptor extends Assertion {
    constructor(opts) { super(); this.opts = { required: false, ...opts }; }
    execute(engine, fileContext) { // Expects a FileContext
        const obj = fileContext.json();
        if (obj === null) {
            if(this.opts.required) fileContext.addIssue('field.missing.parent', `Cannot check for field '${this.opts.key}' because parent is not a valid JSON object.`);
            return;
        }
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

        // If a nested spec is provided, execute it in the field context
        if (this.opts.withSpec && typeof this.opts.withSpec === 'function') {
            const fieldContext = fileContext.createFieldContext(fieldName, value);
            const fieldSpec = engine.executeInContext(fieldContext, this.opts.withSpec);
            fieldSpec.execute(engine, fieldContext);
        }

        // If a semantic type is specified (e.g. is: 'semver' or 'bootConfig'),
        // delegate to a corresponding $.Is.<type> factory if it exists.
        if (this.opts.is && engine.ruleFactories && engine.ruleFactories.$ && engine.ruleFactories.$.Is) {
            const typeKey = this.opts.is;
            const isFactory = engine.ruleFactories.$.Is[typeKey];
            if (typeof isFactory === 'function') {
                const fieldContext = fileContext.createFieldContext(fieldName, value);
                const assertion = isFactory();
                assertion.execute(engine, fieldContext);
            }
        }
    }
}


// --- Generic "Contains" Assertion ---
export class ContainsAssertion extends Assertion {
    constructor(descriptor) { super(); this.descriptor = descriptor; }
    execute(engine, context) {
        // Polymorphically execute the descriptor, which is now an assertion itself.
        this.descriptor.execute(engine, context);
    }
}


// --- "Is" Family Assertions ---
export class IsOneOfAssertion extends Assertion {
    constructor(descriptors) { super(); this.descriptors = descriptors; }
    execute(engine, context) {
        const passedOne = this.descriptors.some(descriptor => descriptor.execute(engine, context));
        if (!passedOne) context.addIssue('target.is.oneof.fail', 'Target does not match any of the specified types.');
    }
}
export class IsJSONAssertion extends Assertion {
  execute(engine, fileContext) { if (fileContext.json() === null) fileContext.addIssue('file.not_json', 'File is not valid JSON.'); }
}
export class IsStringAssertion extends Assertion {
    execute(engine, context) { if (typeof context.value !== 'string') context.addIssue('is.string.fail', 'Value is not a string.'); }
}
export class IsEmptyAssertion extends Assertion {
    execute(engine, context) {
        const subject = context.value !== undefined ? context.value : (context.content ? context.content() : null);
        let isEmpty = false;
        if (subject === null || subject === undefined) isEmpty = true;
        else if (Array.isArray(subject)) isEmpty = subject.length === 0;
        else if (typeof subject === 'string') isEmpty = subject.length === 0;
        else if (typeof subject === 'object') isEmpty = Object.keys(subject).length === 0;
        if (!isEmpty) context.addIssue('is.empty.fail', 'Subject is not empty.');
    }
}
// ... other "Is" assertions can be added here
