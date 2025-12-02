// test/doc.test.ts

import { describe, it, expect } from 'vitest';
import { generateDoc, generateMarkdown } from '../dist/doc.js';
import { Str, Num, Bool } from '../dist/types/primitives.js';
import { Field } from '../dist/types/structural.js';
import { OneOf, ListOf } from '../dist/modifiers/index.js';

describe('generateDoc', () => {
  describe('primitive types with description', () => {
    it('renders Str description', () => {
      const doc = generateDoc(Str({ description: '用户名称' }));
      expect(doc).toContain('用户名称');
    });

    it('renders Num description', () => {
      const doc = generateDoc(Num({ description: '年龄字段', min: 0, max: 150 }));
      expect(doc).toContain('年龄字段');
      expect(doc).toContain('minimum 0');
      expect(doc).toContain('maximum 150');
    });

    it('renders Bool description', () => {
      const doc = generateDoc(Bool({ description: '是否启用' }));
      expect(doc).toContain('是否启用');
    });
  });

  describe('Field with description', () => {
    it('renders field description inline', () => {
      const field = Field({
        key: 'username',
        value: Str({ minLength: 1 }),
        description: '用户登录名',
      });
      const doc = generateDoc(field);
      expect(doc).toContain('username');
      expect(doc).toContain('用户登录名');
    });

    it('renders nested field descriptions', () => {
      const field = Field({
        key: 'user',
        description: '用户对象',
        value: {
          required: [
            Field({ key: 'name', value: Str, description: '姓名' }),
            Field({ key: 'age', value: Num, description: '年龄' }),
          ],
        },
      });
      const doc = generateDoc(field);
      expect(doc).toContain('用户对象');
      expect(doc).toContain('姓名');
      expect(doc).toContain('年龄');
    });
  });

  describe('complex structures', () => {
    it('renders ListOf without description (semantic clear)', () => {
      const list = ListOf(Str({ description: '标签名' }), { min: 1 });
      const doc = generateDoc(list);
      expect(doc).toContain('ListOf');
      expect(doc).toContain('minimum 1 items');
    });

    it('renders OneOf without description (semantic clear)', () => {
      const oneOf = OneOf('active', 'inactive', 'pending');
      const doc = generateDoc(oneOf);
      expect(doc).toContain('OneOf');
    });
  });
});

describe('generateMarkdown', () => {
  it('generates markdown with description after heading', () => {
    const desc = {
      name: 'UserConfig',
      description: '用户配置文件格式说明',
      children: {
        required: [
          { name: 'Field', key: 'name', summary: 'String', description: '用户名' },
        ],
      },
    };
    const md = generateMarkdown(desc);
    expect(md).toContain('# UserConfig');
    expect(md).toContain('用户配置文件格式说明');
    expect(md).toContain('用户名');
  });

  it('renders field description with em dash separator', () => {
    const desc = {
      name: 'Object',
      children: {
        required: [
          { name: 'Field', key: 'email', summary: 'String', description: '邮箱地址' },
        ],
      },
    };
    const md = generateMarkdown(desc);
    expect(md).toContain('email');
    expect(md).toContain('— 邮箱地址');
  });
});
