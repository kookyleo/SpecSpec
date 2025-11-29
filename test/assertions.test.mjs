// test/assertions.test.mjs
// Tests for assertion classes

import { describe, it, expect } from 'vitest';
import {
  Assertion,
  NotAssertion,
  SpecAssertion,
  PackageAssertion,
  IsJSONAssertion,
  IsStringAssertion,
  IsEmptyAssertion,
  ContainsAssertion,
} from '../src/assertions/index.mjs';
import { FieldDescriptor } from '../src/descriptors/index.mjs';

describe('Assertion base class', () => {
  it('should throw if execute is not implemented', () => {
    const assertion = new Assertion();
    expect(() => assertion.execute({}, {})).toThrow(/must implement 'execute'/);
  });
});

describe('NotAssertion', () => {
  it('should invert a passing assertion to fail', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      }
    };

    // Create a passing assertion (IsEmptyAssertion on empty string)
    const passingAssertion = new IsEmptyAssertion();
    const notAssertion = new NotAssertion(passingAssertion);

    // Execute with empty value (IsEmpty would pass, so Not should fail)
    notAssertion.execute({}, { ...mockContext, value: '' });

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('logic.not.fail');
  });

  it('should invert a failing assertion to pass', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      }
    };

    // Create a failing assertion (IsEmptyAssertion on non-empty string)
    const failingAssertion = new IsEmptyAssertion();
    const notAssertion = new NotAssertion(failingAssertion);

    // Execute with non-empty value (IsEmpty would fail, so Not should pass)
    notAssertion.execute({}, { ...mockContext, value: 'hello' });

    expect(mockContext.issues.length).toBe(0);
  });
});

describe('SpecAssertion', () => {
  it('should execute all rules in order', () => {
    const executed = [];

    const mockRule1 = {
      execute: () => executed.push(1)
    };
    const mockRule2 = {
      execute: () => executed.push(2)
    };

    const spec = new SpecAssertion('Test Spec', [mockRule1, mockRule2]);
    spec.execute({}, {});

    expect(executed).toEqual([1, 2]);
  });
});

describe('IsStringAssertion', () => {
  it('should pass for string values', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: 'hello'
    };

    const assertion = new IsStringAssertion();
    assertion.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(0);
  });

  it('should fail for non-string values', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: 123
    };

    const assertion = new IsStringAssertion();
    assertion.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('is.string.fail');
  });
});

describe('IsEmptyAssertion', () => {
  it('should pass for empty string', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: ''
    };

    const assertion = new IsEmptyAssertion();
    assertion.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(0);
  });

  it('should pass for empty array', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: []
    };

    const assertion = new IsEmptyAssertion();
    assertion.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(0);
  });

  it('should pass for empty object', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: {}
    };

    const assertion = new IsEmptyAssertion();
    assertion.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(0);
  });

  it('should fail for non-empty values', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: 'hello'
    };

    const assertion = new IsEmptyAssertion();
    assertion.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('is.empty.fail');
  });
});

describe('ContainsAssertion', () => {
  it('should delegate to descriptor.execute()', () => {
    let executeCalled = false;
    const mockDescriptor = {
      execute: () => { executeCalled = true; }
    };

    const assertion = new ContainsAssertion(mockDescriptor);
    assertion.execute({}, {});

    expect(executeCalled).toBe(true);
  });
});
