// test/descriptors.test.mjs
// Tests for descriptor classes

import { describe, it, expect } from 'vitest';
import {
  DirectoryDescriptor,
  FileTypeDescriptor,
  FileDescriptor,
  FieldDescriptor,
} from '../src/descriptors/index.mjs';

describe('DirectoryDescriptor', () => {
  it('should return true for directory', () => {
    const mockContext = {
      stat: { isDirectory: () => true }
    };

    const descriptor = new DirectoryDescriptor();
    expect(descriptor.execute({}, mockContext)).toBe(true);
  });

  it('should return false for file', () => {
    const mockContext = {
      stat: { isDirectory: () => false }
    };

    const descriptor = new DirectoryDescriptor();
    expect(descriptor.execute({}, mockContext)).toBe(false);
  });

  it('should return falsy when stat is null', () => {
    const mockContext = { stat: null };

    const descriptor = new DirectoryDescriptor();
    expect(descriptor.execute({}, mockContext)).toBeFalsy();
  });
});

describe('FileTypeDescriptor', () => {
  it('should return true for file with matching extension', () => {
    const mockContext = {
      path: '/some/path/file.json',
      stat: { isFile: () => true }
    };

    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    expect(descriptor.execute({}, mockContext)).toBe(true);
  });

  it('should handle extension with leading dot', () => {
    const mockContext = {
      path: '/some/path/file.json',
      stat: { isFile: () => true }
    };

    const descriptor = new FileTypeDescriptor({ withExtension: '.json' });
    expect(descriptor.execute({}, mockContext)).toBe(true);
  });

  it('should return false for non-matching extension', () => {
    const mockContext = {
      path: '/some/path/file.txt',
      stat: { isFile: () => true }
    };

    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    expect(descriptor.execute({}, mockContext)).toBe(false);
  });

  it('should return false for directory', () => {
    const mockContext = {
      path: '/some/path',
      stat: { isFile: () => false }
    };

    const descriptor = new FileTypeDescriptor({ withExtension: 'json' });
    expect(descriptor.execute({}, mockContext)).toBe(false);
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

  it('should not report issue for missing optional field', () => {
    const mockContext = {
      json: () => ({ other: 'value' }),
      addIssue: function() { this.issueAdded = true; },
      issueAdded: false
    };

    const descriptor = new FieldDescriptor({ key: 'name', required: false });
    descriptor.execute({}, mockContext);

    expect(mockContext.issueAdded).toBe(false);
  });

  it('should report issue for missing required field', () => {
    const issues = [];
    const mockContext = {
      json: () => ({ other: 'value' }),
      addIssue: (code, message) => issues.push({ code, message })
    };

    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    descriptor.execute({}, mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('field.missing');
  });

  it('should report issue for empty required field', () => {
    const issues = [];
    const mockContext = {
      json: () => ({ name: '   ' }),
      addIssue: (code, message) => issues.push({ code, message }),
      createFieldContext: () => ({})
    };

    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    descriptor.execute({}, mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('field.empty');
  });

  it('should not report issue for valid required field', () => {
    const issues = [];
    const mockContext = {
      json: () => ({ name: 'valid-name' }),
      addIssue: (code, message) => issues.push({ code, message }),
      createFieldContext: () => ({})
    };

    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    descriptor.execute({}, mockContext);

    expect(issues.length).toBe(0);
  });

  it('should handle null JSON gracefully for optional field', () => {
    const issues = [];
    const mockContext = {
      json: () => null,
      addIssue: (code, message) => issues.push({ code, message })
    };

    const descriptor = new FieldDescriptor({ key: 'name', required: false });
    descriptor.execute({}, mockContext);

    expect(issues.length).toBe(0);
  });

  it('should report issue for null JSON with required field', () => {
    const issues = [];
    const mockContext = {
      json: () => null,
      addIssue: (code, message) => issues.push({ code, message })
    };

    const descriptor = new FieldDescriptor({ key: 'name', required: true });
    descriptor.execute({}, mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('field.missing.parent');
  });
});
