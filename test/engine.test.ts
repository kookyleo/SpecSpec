// test/engine.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SpecEngine } from '../dist/engine.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SpecEngine', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specspec-engine-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('runs a simple spec file', () => {
    // Create spec file
    const specPath = path.join(tmpDir, 'simple.spec.js');
    fs.writeFileSync(specPath, `
      Directory({
        content: {
          required: [
            JsonFile({
              path: 'package.json',
              required: [
                Field({ key: 'name', value: Str() })
              ]
            })
          ]
        }
      })
    `);

    // Create target directory with package.json
    const targetDir = path.join(tmpDir, 'target');
    fs.mkdirSync(targetDir);
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify({ name: 'my-app' })
    );

    const engine = new SpecEngine();
    const result = engine.run(specPath, targetDir);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reports validation errors', () => {
    const specPath = path.join(tmpDir, 'validate.spec.js');
    fs.writeFileSync(specPath, `
      Directory({
        content: {
          required: [
            JsonFile({
              path: 'config.json',
              required: [
                Field({ key: 'port', value: Num({ min: 1, max: 65535 }) })
              ]
            })
          ]
        }
      })
    `);

    const targetDir = path.join(tmpDir, 'target2');
    fs.mkdirSync(targetDir);
    fs.writeFileSync(
      path.join(targetDir, 'config.json'),
      JSON.stringify({ port: 'invalid' })
    );

    const engine = new SpecEngine();
    const result = engine.run(specPath, targetDir);

    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('reports missing file', () => {
    const specPath = path.join(tmpDir, 'missing.spec.js');
    fs.writeFileSync(specPath, `
      Directory({
        content: {
          required: [
            JsonFile({
              path: 'required.json',
              required: []
            })
          ]
        }
      })
    `);

    const targetDir = path.join(tmpDir, 'target3');
    fs.mkdirSync(targetDir);

    const engine = new SpecEngine();
    const result = engine.run(specPath, targetDir);

    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.code === 'file.not_found')).toBe(true);
  });

  it('supports variable definitions for reuse', () => {
    const specPath = path.join(tmpDir, 'reuse.spec.js');
    fs.writeFileSync(specPath, `
      // Reusable definition
      const NameField = Field({ key: 'name', value: Str({ minLength: 1 }) });
      const VersionField = Field({ key: 'version', value: Str({ match: /^\\d+\\.\\d+\\.\\d+$/ }) });

      Directory({
        content: {
          required: [
            JsonFile({
              path: 'package.json',
              required: [NameField, VersionField]
            })
          ]
        }
      })
    `);

    const targetDir = path.join(tmpDir, 'target4');
    fs.mkdirSync(targetDir);
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    );

    const engine = new SpecEngine();
    const result = engine.run(specPath, targetDir);

    expect(result.ok).toBe(true);
  });

  it('reports spec syntax errors', () => {
    const specPath = path.join(tmpDir, 'syntax-error.spec.js');
    fs.writeFileSync(specPath, `
      Directory({ invalid syntax here
    `);

    const engine = new SpecEngine();
    const result = engine.run(specPath, '/any/path');

    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('spec.syntax_error');
  });

  it('reports missing root type', () => {
    const specPath = path.join(tmpDir, 'no-root.spec.js');
    fs.writeFileSync(specPath, `
      // No root type defined
      const x = 1;
    `);

    const engine = new SpecEngine();
    const result = engine.run(specPath, '/any/path');

    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('spec.no_root');
  });

  it('supports custom types via register', async () => {
    // Custom Email type - validates that value contains @
    const { Type } = await import('../dist/base.js');
    class EmailType extends Type<void, string> {
      validate(value: unknown, ctx: any) {
        if (typeof value !== 'string') {
          ctx.addIssue('email.invalid', `Expected string, got ${typeof value}`);
          return;
        }
        if (!value.includes('@')) {
          ctx.addIssue('email.invalid', `Invalid email, missing @: ${value}`);
        }
      }
    }
    const Email = () => new EmailType(undefined);

    // Simple spec that just validates a directory exists
    const specPath = path.join(tmpDir, 'custom.spec.js');
    fs.writeFileSync(specPath, `
      // Use custom Email type directly on a value
      const emailValidator = Email();

      // For now just verify Directory works
      Directory()
    `);

    const targetDir = path.join(tmpDir, 'target5');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir);
    }

    const engine = new SpecEngine();
    engine.register({ Email });
    const result = engine.run(specPath, targetDir);

    // Should pass - target5 is a directory
    expect(result.ok).toBe(true);
  });
});
