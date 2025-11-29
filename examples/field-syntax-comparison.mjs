#!/usr/bin/env node
// examples/field-syntax-comparison.mjs
// Demonstrates RequiredField/OptionalField syntax sugar

import { createCoreDsl } from '../src/index.mjs';

const { $, Spec, Field } = createCoreDsl();

console.log('=== Field Syntax Comparison ===\n');

// 传统方式
console.log('Traditional syntax:');
console.log('  $.Has.Field({ key: "name", required: true })');
console.log('  $.Has.Field({ key: "description", required: false })');
console.log('  $.Has.Field({ key: "author" })  // defaults to required: false');

console.log('\n语法糖方式 (Syntax sugar):');
console.log('  $.Has.RequiredField({ key: "name" })');
console.log('  $.Has.OptionalField({ key: "description" })');

console.log('\n---\n');

// 验证两种方式生成相同的配置
const traditional = $.Has.Field({ key: 'name', required: true });
const syntaxSugar = $.Has.RequiredField({ key: 'name' });

console.log('Verification:');
console.log('  Traditional opts:', JSON.stringify(traditional.descriptor.opts));
console.log('  Syntax sugar opts:', JSON.stringify(syntaxSugar.descriptor.opts));
console.log('  Equal:', JSON.stringify(traditional.descriptor.opts) === JSON.stringify(syntaxSugar.descriptor.opts) ? '✓' : '✗');

console.log('\n---\n');

// 实际使用示例
console.log('Real-world example:\n');
console.log(`
Spec('Package Manifest', [
  $.Is.JSON(),

  // 必须字段
  $.Has.RequiredField({ key: 'name' }),
  $.Has.RequiredField({ key: 'version' }),

  // 可选字段
  $.Has.OptionalField({ key: 'description' }),
  $.Has.OptionalField({ key: 'keywords' }),
  $.Has.OptionalField({ key: 'author' }),

  // 带嵌套验证的必须字段
  $.Has.RequiredField({
    key: 'main',
    withSpec: () => Spec('Main Entry', [
      $.Is.String(),
      $.Is.Not.Empty()
    ])
  })
])
`);
