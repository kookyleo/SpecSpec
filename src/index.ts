// src/index.ts
// Main entry point for @specspec/core

// Base classes
export { Type, Modifier, validateAny, tryMatch } from './base.js';
export type { Validatable, LiteralValue, ObjectSpec } from './base.js';

// Context
export { ValidationContext } from './context.js';
export type { Context, Issue } from './context.js';

// Primitive types
export { Str, StrType, type StrSpec } from './types/primitives.js';
export { Bool, BoolType, type BoolSpec } from './types/primitives.js';
export { Num, NumType, type NumSpec } from './types/primitives.js';

// Structural types
export { Field, FieldType, type FieldSpec } from './types/structural.js';
export { File, FileType, type FileSpec } from './types/structural.js';
export { Directory, DirectoryType, type DirectorySpec } from './types/structural.js';
export { JsonFile, JsonFileType, type JsonFileSpec } from './types/structural.js';

// Modifiers
export { OneOf, OneOfModifier } from './modifiers/oneof.js';
export { ListOf, ListOfModifier, type ListOfSpec } from './modifiers/listof.js';

// Engine
export { SpecEngine, createEngine, type ValidationResult, type EngineOptions } from './engine.js';
