// src/codegen/index.ts
// Code generation exports

// Base classes and utilities
export { CodeGenerator, type LanguageConfig } from './base.js';

// Language-specific generators
export { generatePython, PythonGenerator } from './python/generator.js';
export { generateTypeScript, TypeScriptGenerator } from './typescript/generator.js';
export { generateSwift, SwiftGenerator } from './swift/generator.js';
export { generateRust, RustGenerator } from './rust/generator.js';

// Registry of available generators
import { PythonGenerator } from './python/generator.js';
import { TypeScriptGenerator } from './typescript/generator.js';
import { SwiftGenerator } from './swift/generator.js';
import { RustGenerator } from './rust/generator.js';
import type { CodeGenerator } from './base.js';

/**
 * Get all registered code generators
 */
export function getGenerators(): Map<string, () => CodeGenerator> {
  const generators = new Map<string, () => CodeGenerator>();
  generators.set('python', () => new PythonGenerator());
  generators.set('typescript', () => new TypeScriptGenerator());
  generators.set('swift', () => new SwiftGenerator());
  generators.set('rust', () => new RustGenerator());
  return generators;
}

/**
 * Get list of supported language names
 */
export function getSupportedLanguages(): string[] {
  return Array.from(getGenerators().keys());
}
