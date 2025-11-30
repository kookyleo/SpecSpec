#!/usr/bin/env node
// run-example.js
// Usage: node run-example.js <spec-file> <target-path>

import { SpecEngine } from '../dist/index.js';
import path from 'node:path';

const [specFile, targetPath] = process.argv.slice(2);

if (!specFile || !targetPath) {
  console.error('Usage: node run-example.js <spec-file> <target-path>');
  console.error('');
  console.error('Examples:');
  console.error('  node run-example.js node-package.spec.js /path/to/project');
  console.error('  node run-example.js api-config.spec.js /path/to/config/dir');
  process.exit(1);
}

const specPath = path.resolve(process.cwd(), specFile);
const target = path.resolve(process.cwd(), targetPath);

console.log(`Validating: ${target}`);
console.log(`Using spec: ${specPath}`);
console.log('');

const engine = new SpecEngine();
const result = engine.run(specPath, target);

if (result.ok) {
  console.log('Validation passed!');
} else {
  console.log('Validation failed:');
  for (const issue of result.issues) {
    const pathStr = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    console.log(`  [${issue.level}] ${issue.code}: ${issue.message}`);
    console.log(`    at: ${pathStr}`);
  }
  process.exit(1);
}
