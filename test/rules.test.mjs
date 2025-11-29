// test/rules.test.mjs
// Tests for rule classes

import { describe, it, expect } from 'vitest';
import {
  IsNot,
  DoesNot,
  IsJSONRule,
  IsStringRule,
  IsEmptyRule,
  ContainsRule,
} from '../dist/rules/index.js';
import { Spec } from '../dist/spec.js';

describe('IsNot', () => {
  it('should invert a passing rule to fail', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      }
    };

    const passingRule = new IsEmptyRule();
    const isNotRule = new IsNot(passingRule);

    isNotRule.execute({}, { ...mockContext, value: '' });

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('is.not.fail');
  });

  it('should invert a failing rule to pass', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      }
    };

    const failingRule = new IsEmptyRule();
    const isNotRule = new IsNot(failingRule);

    isNotRule.execute({}, { ...mockContext, value: 'hello' });

    expect(mockContext.issues.length).toBe(0);
  });
});

describe('DoesNot', () => {
  it('should pass when inner ContainsRule fails', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      }
    };

    const mockDescriptor = { opts: {}, constructor: { name: 'TestDescriptor' } };
    const mockValidator = {
      validate: (d, e, ctx) => {
        ctx.addIssue('file.missing', 'File not found');
      }
    };
    const mockEngine = {
      getValidator: () => mockValidator
    };

    const containsRule = new ContainsRule(mockDescriptor);
    const doesNotRule = new DoesNot(containsRule, mockDescriptor);

    doesNotRule.execute(mockEngine, mockContext);

    // No issues because file.missing was swallowed (inverted)
    expect(mockContext.issues.length).toBe(0);
  });

  it('should fail when inner ContainsRule passes', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      }
    };

    const mockDescriptor = { opts: {}, constructor: { name: 'TestDescriptor' } };
    const mockValidator = {
      validate: () => { /* passes, no issues */ }
    };
    const mockEngine = {
      getValidator: () => mockValidator
    };

    const containsRule = new ContainsRule(mockDescriptor);
    const doesNotRule = new DoesNot(containsRule, mockDescriptor);

    doesNotRule.execute(mockEngine, mockContext);

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('does.not.contain.fail');
  });
});

describe('Spec', () => {
  it('should be a simple container with name and rules', () => {
    const rules = [new IsStringRule()];
    const spec = new Spec('Test Spec', rules);

    expect(spec.name).toBe('Test Spec');
    expect(spec.rules).toBe(rules);
    expect(spec.rules).toHaveLength(1);
  });
});

describe('IsStringRule', () => {
  it('should pass for string values', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: 'hello'
    };

    const rule = new IsStringRule();
    rule.execute({}, mockContext);

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

    const rule = new IsStringRule();
    rule.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('is.string.fail');
  });
});

describe('IsEmptyRule', () => {
  it('should pass for empty string', () => {
    const mockContext = {
      issues: [],
      addIssue: function(code, message) {
        this.issues.push({ code, message });
      },
      value: ''
    };

    const rule = new IsEmptyRule();
    rule.execute({}, mockContext);

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

    const rule = new IsEmptyRule();
    rule.execute({}, mockContext);

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

    const rule = new IsEmptyRule();
    rule.execute({}, mockContext);

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

    const rule = new IsEmptyRule();
    rule.execute({}, mockContext);

    expect(mockContext.issues.length).toBe(1);
    expect(mockContext.issues[0].code).toBe('is.empty.fail');
  });
});

describe('ContainsRule', () => {
  it('should call engine.getValidator() with descriptor', () => {
    const mockDescriptor = { opts: {} };
    let validatorCalled = false;

    const mockValidator = {
      validate: () => { validatorCalled = true; }
    };

    const mockEngine = {
      getValidator: () => mockValidator
    };

    const rule = new ContainsRule(mockDescriptor);
    rule.execute(mockEngine, {});

    expect(validatorCalled).toBe(true);
  });

  it('should throw if no validator found', () => {
    const mockDescriptor = { constructor: { name: 'TestDescriptor' }, opts: {} };
    const mockEngine = {
      getValidator: () => null
    };

    const rule = new ContainsRule(mockDescriptor);
    expect(() => rule.execute(mockEngine, {})).toThrow(/No validator found/);
  });
});
