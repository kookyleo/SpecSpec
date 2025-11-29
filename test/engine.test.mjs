// test/engine.test.mjs
// Tests for ValidationEngine

import { describe, it, expect, beforeEach } from 'vitest';
import { createConfiguredEngine } from '../src/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

describe('ValidationEngine', () => {
  let engine;

  beforeEach(() => {
    const configured = createConfiguredEngine();
    engine = configured.engine;
  });

  describe('run()', () => {
    it('should validate a valid package with RequiredField', () => {
      const specPath = path.join(fixturesDir, 'specs', 'required-field.spec.js');
      const targetPath = path.join(fixturesDir, 'valid-package');

      const result = engine.run(specPath, targetPath);
      expect(result.ok).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should report missing required field', () => {
      const specPath = path.join(fixturesDir, 'specs', 'required-field.spec.js');
      const targetPath = path.join(fixturesDir, 'invalid-package');

      const result = engine.run(specPath, targetPath);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.code === 'field.missing')).toBe(true);
    });

    it('should pass with OptionalField when field is missing', () => {
      const specPath = path.join(fixturesDir, 'specs', 'optional-field.spec.js');
      const targetPath = path.join(fixturesDir, 'invalid-package');

      const result = engine.run(specPath, targetPath);
      expect(result.ok).toBe(true);
    });

    it('should handle spec syntax errors gracefully', () => {
      const specPath = path.join(fixturesDir, 'specs', 'syntax-error.spec.js');
      const targetPath = path.join(fixturesDir, 'valid-package');

      const result = engine.run(specPath, targetPath);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.code === 'spec.crash')).toBe(true);
    });

    it('should handle empty spec file', () => {
      const specPath = path.join(fixturesDir, 'specs', 'empty.spec.js');
      const targetPath = path.join(fixturesDir, 'valid-package');

      const result = engine.run(specPath, targetPath);
      expect(result.ok).toBe(false);
      expect(result.issues.some(i => i.code === 'spec.empty')).toBe(true);
    });
  });
});
