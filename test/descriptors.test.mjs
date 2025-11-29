// test/descriptors.test.mjs
// Tests for descriptor classes (pure data) and their validators

import { describe, it, expect } from 'vitest';
import {
  DirectoryDescriptor,
  FileTypeDescriptor,
  FileDescriptor,
  FieldDescriptor,
  PackageDescriptor,
} from '../src/descriptors/index.mjs';
import {
  DirectoryMatcher,
  FileTypeMatcher,
  FieldValidator,
  PackageValidator,
} from '../src/validators/index.mjs';

describe('DirectoryDescriptor', () => {
  it('should be pure data with opts', () => {
    const descriptor = new DirectoryDescriptor({ name: 'test' });
    expect(descriptor.opts).toEqual({ name: 'test' });
  });
});

describe('DirectoryMatcher', () => {
  const matcher = new DirectoryMatcher();

  it('should match directory', () => {
    const descriptor = new DirectoryDescriptor();
    const mockContext = {
      stat: { isDirectory: () => true }
    };
    expect(matcher.matches(descriptor, {}, mockContext)).toBe(true);
  });

  it('should not match file', () => {
    const descriptor = new DirectoryDescriptor();
    const mockContext = {
      stat: { isDirectory: () => false }
    };
    expect(matcher.matches(descriptor, {}, mockContext)).toBe(false);
  });

  it('should return falsy when stat is null', () => {
    const descriptor = new DirectoryDescriptor();
    const mockContext = { stat: null };
    expect(matcher.matches(descriptor, {}, mockContext)).toBeFalsy();
  });
});

describe('FileTypeDescriptor', () => {
  it('should be pure data with opts', () => {
    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    expect(descriptor.opts).toEqual({ withExtension: 'json' });
  });
});

describe('FileTypeMatcher', () => {
  const matcher = new FileTypeMatcher();

  it('should match file with correct extension', () => {
    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    const mockContext = {
      path: '/some/path/file.json',
      stat: { isFile: () => true }
    };
    expect(matcher.matches(descriptor, {}, mockContext)).toBe(true);
  });

  it('should handle extension with leading dot', () => {
    const descriptor = new FileTypeDescriptor({ withExtension: '.json' });
    const mockContext = {
      path: '/some/path/file.json',
      stat: { isFile: () => true }
    };
    expect(matcher.matches(descriptor, {}, mockContext)).toBe(true);
  });

  it('should not match wrong extension', () => {
    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    const mockContext = {
      path: '/some/path/file.txt',
      stat: { isFile: () => true }
    };
    expect(matcher.matches(descriptor, {}, mockContext)).toBe(false);
  });

  it('should not match directory', () => {
    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    const mockContext = {
      path: '/some/path',
      stat: { isFile: () => false }
    };
    expect(matcher.matches(descriptor, {}, mockContext)).toBe(false);
  });
});

describe('FieldDescriptor', () => {
  it('should default required to false', () => {
    const descriptor = new FieldDescriptor({ key: 'name' });
    expect(descriptor.opts.required).toBe(false);
  });

  it('should respect explicit required: true', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    expect(descriptor.opts.required).toBe(true);
  });
});

describe('FieldValidator', () => {
  const validator = new FieldValidator();

  it('should not report issue for missing optional field', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: false });
    const mockContext = {
      json: () => ({ other: 'value' }),
      addIssue: function() { this.issueAdded = true; },
      issueAdded: false
    };

    validator.validate(descriptor, {}, mockContext);

    expect(mockContext.issueAdded).toBe(false);
  });

  it('should report issue for missing required field', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    const issues = [];
    const mockContext = {
      json: () => ({ other: 'value' }),
      addIssue: (code, message) => issues.push({ code, message })
    };

    validator.validate(descriptor, {}, mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('field.missing');
  });

  it('should report issue for empty required field', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    const issues = [];
    const mockContext = {
      json: () => ({ name: '   ' }),
      addIssue: (code, message) => issues.push({ code, message }),
      createFieldContext: () => ({})
    };

    validator.validate(descriptor, {}, mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('field.empty');
  });

  it('should not report issue for valid required field', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    const issues = [];
    const mockContext = {
      json: () => ({ name: 'valid-name' }),
      addIssue: (code, message) => issues.push({ code, message }),
      createFieldContext: () => ({})
    };

    validator.validate(descriptor, {}, mockContext);

    expect(issues.length).toBe(0);
  });

  it('should handle null JSON gracefully for optional field', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: false });
    const issues = [];
    const mockContext = {
      json: () => null,
      addIssue: (code, message) => issues.push({ code, message })
    };

    validator.validate(descriptor, {}, mockContext);

    expect(issues.length).toBe(0);
  });

  it('should report issue for null JSON with required field', () => {
    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    const issues = [];
    const mockContext = {
      json: () => null,
      addIssue: (code, message) => issues.push({ code, message })
    };

    validator.validate(descriptor, {}, mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('field.missing.parent');
  });
});

describe('PackageDescriptor', () => {
  it('should be pure data with opts', () => {
    const descriptor = new PackageDescriptor({ withSpec: () => {} });
    expect(descriptor.opts.withSpec).toBeDefined();
  });
});
