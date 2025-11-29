// SpecSpec/src/descriptors/content.mjs
// Content Descriptors (for $.Contains)

import fs from 'node:fs';
import path from 'node:path';
import { Assertion } from '../assertions/base.mjs';

export class FileDescriptor extends Assertion {
  constructor(opts) {
    super();
    this.opts = opts;
  }

  execute(engine, packageContext) {
    const filePath = this.opts.path;
    const fileFullPath = path.join(packageContext.path, filePath);
    const fileExists = fs.existsSync(fileFullPath) && fs.statSync(fileFullPath).isFile();
    const subSpecFunc = this.opts.withSpec;

    if (!fileExists) {
      // Always report missing file so that $.DoesNot.Contain works correctly
      packageContext.addIssue('file.missing', `File not found: '${filePath}'`);
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
  constructor(opts) {
    super();
    this.opts = { required: false, ...opts };
  }

  execute(engine, fileContext) {
    const obj = fileContext.json();
    if (obj === null) {
      if (this.opts.required) {
        fileContext.addIssue('field.missing.parent',
          `Cannot check for field '${this.opts.key}' because parent is not a valid JSON object.`);
      }
      return;
    }

    const fieldName = this.opts.key;
    const value = obj[fieldName];
    const isPresent = fieldName in obj && value !== null && value !== undefined;

    if (!isPresent) {
      if (this.opts.required) {
        fileContext.addIssue('field.missing', `Required field not found: '${fieldName}'`);
      }
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

    // If a semantic type is specified, delegate to $.Is.<type>
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
