// test/assertions.test.mjs
// Tests for assertion classes

import { describe, it, expect } from 'vitest';
import {
  Assertion,
  NotAssertion,
  IsJSONAssertion,
  IsStringAssertion,
  IsEmptyAssertion,
  ContainsAssertion,
} from '../src/assertions/index.mjs';
import { Spec } from '../src/spec.mjs';

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

    const passingAssertion = new IsEmptyAssertion();
    const notAssertion = new NotAssertion(passingAssertion);

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

    const failingAssertion = new IsEmptyAssertion();
    const notAssertion = new NotAssertion(failingAssertion);

    notAssertion.execute({}, { ...mockContext, value: 'hello' });

    expect(mockContext.issues.length).toBe(0);
  });
});

describe('Spec', () => {
  it('should be a simple container with name and rules', () => {
    const rules = [new IsStringAssertion()];
    const spec = new Spec('Test Spec', rules);

    expect(spec.name).toBe('Test Spec');
    expect(spec.rules).toBe(rules);
    expect(spec.rules).toHaveLength(1);
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
  it('should call engine.getValidator() with descriptor', () => {
    const mockDescriptor = { opts: {} };
    let validatorCalled = false;

    const mockValidator = {
      validate: () => { validatorCalled = true; }
    };

    const mockEngine = {
      getValidator: () => mockValidator
    };

    const assertion = new ContainsAssertion(mockDescriptor);
    assertion.execute(mockEngine, {});

    expect(validatorCalled).toBe(true);
  });

  it('should throw if no validator found', () => {
    const mockDescriptor = { constructor: { name: 'TestDescriptor' }, opts: {} };
    const mockEngine = {
      getValidator: () => null
    };

    const assertion = new ContainsAssertion(mockDescriptor);
    expect(() => assertion.execute(mockEngine, {})).toThrow(/No validator found/);
  });
});
