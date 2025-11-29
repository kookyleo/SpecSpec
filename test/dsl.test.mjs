// test/dsl.test.mjs
// Tests for DSL factory functions

import { describe, it, expect } from 'vitest';
import { createCoreDsl, Spec } from '../dist/index.js';
import * as Rules from '../dist/rules/index.js';
import * as Descriptors from '../dist/descriptors/index.js';

describe('createCoreDsl', () => {
  const dsl = createCoreDsl();

  describe('exports', () => {
    it('should export Package factory', () => {
      expect(typeof dsl.Package).toBe('function');
    });

    it('should export Spec factory', () => {
      expect(typeof dsl.Spec).toBe('function');
    });

    it('should export $ with Is, Contains, Has, DoesNot', () => {
      expect(dsl.$).toBeDefined();
      expect(dsl.$.Is).toBeDefined();
      expect(dsl.$.Contains).toBeDefined();
      expect(dsl.$.Has).toBeDefined();
      expect(dsl.$.DoesNot).toBeDefined();
    });

    it('should export descriptor factories', () => {
      expect(typeof dsl.Directory).toBe('function');
      expect(typeof dsl.File).toBe('function');
      expect(typeof dsl.Field).toBe('function');
    });
  });

  describe('$.Is', () => {
    it('should create IsJSONRule', () => {
      const rule = dsl.$.Is.JSON();
      expect(rule).toBeInstanceOf(Rules.IsJSONRule);
    });

    it('should create IsStringRule', () => {
      const rule = dsl.$.Is.String();
      expect(rule).toBeInstanceOf(Rules.IsStringRule);
    });

    it('should create IsEmptyRule', () => {
      const rule = dsl.$.Is.Empty();
      expect(rule).toBeInstanceOf(Rules.IsEmptyRule);
    });

    it('should create IsOneOfRule', () => {
      const rule = dsl.$.Is.OneOf([dsl.Directory()]);
      expect(rule).toBeInstanceOf(Rules.IsOneOfRule);
    });

  });

  describe('$.IsNot', () => {
    it('should support $.IsNot.Empty()', () => {
      const rule = dsl.$.IsNot.Empty();
      expect(rule).toBeInstanceOf(Rules.IsNot);
    });

    it('should support $.IsNot.JSON()', () => {
      const rule = dsl.$.IsNot.JSON();
      expect(rule).toBeInstanceOf(Rules.IsNot);
    });

    it('should support $.IsNot.String()', () => {
      const rule = dsl.$.IsNot.String();
      expect(rule).toBeInstanceOf(Rules.IsNot);
    });
  });

  describe('$.Contains', () => {
    it('should create ContainsRule with descriptor', () => {
      const rule = dsl.$.Contains(dsl.File({ path: 'test.json' }));
      expect(rule).toBeInstanceOf(Rules.ContainsRule);
    });

    it('should support shorthand $.Contains.File()', () => {
      const rule = dsl.$.Contains.File({ path: 'test.json' });
      expect(rule).toBeInstanceOf(Rules.ContainsRule);
      expect(rule.descriptor).toBeInstanceOf(Descriptors.FileDescriptor);
    });

    it('should support shorthand $.Contains.Field()', () => {
      const rule = dsl.$.Contains.Field({ key: 'name' });
      expect(rule).toBeInstanceOf(Rules.ContainsRule);
      expect(rule.descriptor).toBeInstanceOf(Descriptors.FieldDescriptor);
    });
  });

  describe('$.Has', () => {
    it('should support $.Has.Field()', () => {
      const rule = dsl.$.Has.Field({ key: 'name' });
      expect(rule).toBeInstanceOf(Rules.ContainsRule);
      expect(rule.descriptor.opts.key).toBe('name');
    });

    it('should support $.Has.RequiredField() syntax sugar', () => {
      const rule = dsl.$.Has.RequiredField({ key: 'name' });
      expect(rule).toBeInstanceOf(Rules.ContainsRule);
      expect(rule.descriptor.opts.key).toBe('name');
      expect(rule.descriptor.opts.required).toBe(true);
    });

    it('should support $.Has.OptionalField() syntax sugar', () => {
      const rule = dsl.$.Has.OptionalField({ key: 'description' });
      expect(rule).toBeInstanceOf(Rules.ContainsRule);
      expect(rule.descriptor.opts.key).toBe('description');
      expect(rule.descriptor.opts.required).toBe(false);
    });

    it('RequiredField should override explicit required: false', () => {
      const rule = dsl.$.Has.RequiredField({ key: 'name', required: false });
      expect(rule.descriptor.opts.required).toBe(true);
    });

    it('OptionalField should override explicit required: true', () => {
      const rule = dsl.$.Has.OptionalField({ key: 'name', required: true });
      expect(rule.descriptor.opts.required).toBe(false);
    });
  });

  describe('$.DoesNot', () => {
    it('should support $.DoesNot.Contain()', () => {
      const rule = dsl.$.DoesNot.Contain(dsl.File({ path: 'debug.log' }));
      expect(rule).toBeInstanceOf(Rules.DoesNot);
    });
  });

  describe('Spec', () => {
    it('should create Spec with name and rules', () => {
      const spec = dsl.Spec('Test Spec', [
        dsl.$.Is.JSON(),
      ]);
      expect(spec).toBeInstanceOf(Spec);
      expect(spec.name).toBe('Test Spec');
      expect(spec.rules).toHaveLength(1);
    });
  });

  describe('Package', () => {
    it('should create PackageDescriptor', () => {
      const pkg = dsl.Package({
        withSpec: () => dsl.Spec('Package Rules', []),
      });
      expect(pkg).toBeInstanceOf(Descriptors.PackageDescriptor);
    });
  });
});
