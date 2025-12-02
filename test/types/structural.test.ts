// test/types/structural.test.ts

import { describe, it, expect } from 'vitest';
import { Field, JsonFile } from '../../dist/types/structural.js';
import { Str, Num } from '../../dist/types/primitives.js';
import { createTestContext } from '../helpers.js';

describe('Field', () => {
  it('validates required field exists', () => {
    const ctx = createTestContext();
    const obj = { name: 'Alice' };
    Field({ key: 'name', value: Str() }).validate(obj, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('includes description in describe()', () => {
    const desc = Field({ key: 'name', value: Str(), description: '用户姓名' }).describe();
    expect(desc.description).toBe('用户姓名');
    expect(desc.key).toBe('name');
  });

  it('reports missing required field', () => {
    const ctx = createTestContext();
    const obj = { other: 'value' };
    Field({ key: 'name', value: Str() }).validate(obj, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('field.missing');
  });

  it('skips missing optional field', () => {
    const ctx = createTestContext();
    const obj = { other: 'value' };
    Field({ key: 'name', value: Str(), optional: true }).validate(obj, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('validates field value type', () => {
    const ctx = createTestContext();
    const obj = { age: 'not a number' };
    Field({ key: 'age', value: Num() }).validate(obj, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].code).toBe('type.mismatch');
  });

  it('validates nested object spec', () => {
    const ctx = createTestContext();
    const obj = {
      user: {
        name: 'Alice',
        age: 30
      }
    };
    Field({
      key: 'user',
      value: {
        required: [
          Field({ key: 'name', value: Str() }),
          Field({ key: 'age', value: Num() })
        ]
      }
    }).validate(obj, ctx);
    expect(ctx.issues).toHaveLength(0);
  });

  it('reports nested validation errors', () => {
    const ctx = createTestContext();
    const obj = {
      user: {
        name: 123  // Should be string
      }
    };
    Field({
      key: 'user',
      value: {
        required: [
          Field({ key: 'name', value: Str() })
        ]
      }
    }).validate(obj, ctx);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].path).toContain('user');
  });
});

describe('JsonFile', () => {
  it('includes description in describe()', () => {
    const desc = JsonFile({
      path: 'config.json',
      description: '配置文件',
      required: [Field({ key: 'name', value: Str() })],
    }).describe();
    expect(desc.description).toBe('配置文件');
    expect(desc.filePath).toBe('config.json');
  });

  it('validates JSON file with fields', () => {
    const ctx = createTestContext();
    // Create a temporary test file
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'specspec-'));
    const jsonPath = path.join(tmpDir, 'test.json');
    fs.writeFileSync(jsonPath, JSON.stringify({ name: 'test', version: '1.0.0' }));

    try {
      JsonFile({
        path: 'test.json',
        required: [
          Field({ key: 'name', value: Str() }),
          Field({ key: 'version', value: Str() })
        ]
      }).validate(tmpDir, ctx);
      expect(ctx.issues).toHaveLength(0);
    } finally {
      fs.unlinkSync(jsonPath);
      fs.rmdirSync(tmpDir);
    }
  });

  it('reports missing JSON file', () => {
    const ctx = createTestContext();
    const fs = require('fs');
    const tmpDir = fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'specspec-'));

    try {
      JsonFile({
        path: 'nonexistent.json',
        required: []
      }).validate(tmpDir, ctx);
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].code).toBe('file.not_found');
    } finally {
      fs.rmdirSync(tmpDir);
    }
  });

  it('reports invalid JSON', () => {
    const ctx = createTestContext();
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'specspec-'));
    const jsonPath = path.join(tmpDir, 'invalid.json');
    fs.writeFileSync(jsonPath, '{ invalid json }');

    try {
      JsonFile({
        path: 'invalid.json',
        required: []
      }).validate(tmpDir, ctx);
      expect(ctx.issues).toHaveLength(1);
      expect(ctx.issues[0].code).toBe('json.parse_error');
    } finally {
      fs.unlinkSync(jsonPath);
      fs.rmdirSync(tmpDir);
    }
  });
});
