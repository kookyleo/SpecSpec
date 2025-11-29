// test/dsl.test.mjs
// Tests for DSL factory functions

import { describe, it, expect } from 'vitest';
import { createCoreDsl, Assertions, Descriptors, Spec } from '../src/index.mjs';

describe('createCoreDsl', () => {
  const dsl = createCoreDsl();

  describe('exports', () => {
    it('should export Package factory', () => {
      expect(typeof dsl.Package).toBe('function');
    });

    it('should export Spec factory', () => {
      expect(typeof dsl.Spec).toBe('function');
    });

    it('should export Not factory', () => {
      expect(typeof dsl.Not).toBe('function');
    });

    it('should export $ with Is, Contains, Has', () => {
      expect(dsl.$).toBeDefined();
      expect(dsl.$.Is).toBeDefined();
      expect(dsl.$.Contains).toBeDefined();
      expect(dsl.$.Has).toBeDefined();
    });

    it('should export descriptor factories', () => {
      expect(typeof dsl.Directory).toBe('function');
      expect(typeof dsl.FileType).toBe('function');
      expect(typeof dsl.File).toBe('function');
      expect(typeof dsl.Field).toBe('function');
    });
  });

  describe('$.Is', () => {
    it('should create IsJSONAssertion', () => {
      const assertion = dsl.$.Is.JSON();
      expect(assertion).toBeInstanceOf(Assertions.IsJSONAssertion);
    });

    it('should create IsStringAssertion', () => {
      const assertion = dsl.$.Is.String();
      expect(assertion).toBeInstanceOf(Assertions.IsStringAssertion);
    });

    it('should create IsEmptyAssertion', () => {
      const assertion = dsl.$.Is.Empty();
      expect(assertion).toBeInstanceOf(Assertions.IsEmptyAssertion);
    });

    it('should create IsOneOfAssertion', () => {
      const assertion = dsl.$.Is.OneOf([dsl.Directory()]);
      expect(assertion).toBeInstanceOf(Assertions.IsOneOfAssertion);
    });

    it('should support chained negation $.Is.Not.Empty()', () => {
      const assertion = dsl.$.Is.Not.Empty();
      expect(assertion).toBeInstanceOf(Assertions.NotAssertion);
    });
  });

  describe('$.Contains', () => {
    it('should create ContainsAssertion with descriptor', () => {
      const assertion = dsl.$.Contains(dsl.File({ path: 'test.json' }));
      expect(assertion).toBeInstanceOf(Assertions.ContainsAssertion);
    });

    it('should support shorthand $.Contains.File()', () => {
      const assertion = dsl.$.Contains.File({ path: 'test.json' });
      expect(assertion).toBeInstanceOf(Assertions.ContainsAssertion);
      expect(assertion.descriptor).toBeInstanceOf(Descriptors.FileDescriptor);
    });

    it('should support shorthand $.Contains.Field()', () => {
      const assertion = dsl.$.Contains.Field({ key: 'name' });
      expect(assertion).toBeInstanceOf(Assertions.ContainsAssertion);
      expect(assertion.descriptor).toBeInstanceOf(Descriptors.FieldDescriptor);
    });
  });

  describe('$.Has', () => {
    it('should support $.Has.Field()', () => {
      const assertion = dsl.$.Has.Field({ key: 'name' });
      expect(assertion).toBeInstanceOf(Assertions.ContainsAssertion);
      expect(assertion.descriptor.opts.key).toBe('name');
    });

    it('should support $.Has.RequiredField() syntax sugar', () => {
      const assertion = dsl.$.Has.RequiredField({ key: 'name' });
      expect(assertion).toBeInstanceOf(Assertions.ContainsAssertion);
      expect(assertion.descriptor.opts.key).toBe('name');
      expect(assertion.descriptor.opts.required).toBe(true);
    });

    it('should support $.Has.OptionalField() syntax sugar', () => {
      const assertion = dsl.$.Has.OptionalField({ key: 'description' });
      expect(assertion).toBeInstanceOf(Assertions.ContainsAssertion);
      expect(assertion.descriptor.opts.key).toBe('description');
      expect(assertion.descriptor.opts.required).toBe(false);
    });

    it('RequiredField should override explicit required: false', () => {
      const assertion = dsl.$.Has.RequiredField({ key: 'name', required: false });
      expect(assertion.descriptor.opts.required).toBe(true);
    });

    it('OptionalField should override explicit required: true', () => {
      const assertion = dsl.$.Has.OptionalField({ key: 'name', required: true });
      expect(assertion.descriptor.opts.required).toBe(false);
    });
  });

  describe('$.DoesNot', () => {
    it('should support $.DoesNot.Contain()', () => {
      const assertion = dsl.$.DoesNot.Contain(dsl.File({ path: 'debug.log' }));
      expect(assertion).toBeInstanceOf(Assertions.NotAssertion);
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
