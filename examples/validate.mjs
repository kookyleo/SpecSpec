#!/usr/bin/env node
// examples/validate.mjs
// Example validation runner

import { createConfiguredEngine } from '../dist/index.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create configured engine with all validators registered
const { engine } = createConfiguredEngine();

// Run validation
const specPath = path.join(__dirname, 'basic-package', 'Spec.js');
const targetPath = path.join(__dirname, 'basic-package');

console.log('Validating:', targetPath);
console.log('Using spec:', specPath);
console.log('---');

const result = engine.run(specPath, targetPath);

if (result.ok) {
  console.log('✓ Validation passed!');
} else {
  console.log('✗ Validation failed:');
  for (const issue of result.issues) {
    console.log(`  [${issue.code}] ${issue.message}`);
    if (issue.path) {
      console.log(`    at: ${issue.path}`);
    }
  }
}

process.exit(result.ok ? 0 : 1);
