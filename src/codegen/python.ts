// src/codegen/python.ts
// Python code generator - generates Python validators from TypeDescription

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TypeDescription } from '../base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Code generation context
 */
interface CodegenContext {
  /** Generated function names */
  functions: Map<string, string>;
  /** Function counter for unique names */
  counter: number;
  /** Output lines */
  lines: string[];
  /** Indentation level */
  indent: number;
}

/**
 * Create a new codegen context
 */
function createContext(): CodegenContext {
  return {
    functions: new Map(),
    counter: 0,
    lines: [],
    indent: 0,
  };
}

/**
 * Add a line with current indentation
 */
function emit(ctx: CodegenContext, line: string): void {
  ctx.lines.push('    '.repeat(ctx.indent) + line);
}

/**
 * Add an empty line
 */
function emitBlank(ctx: CodegenContext): void {
  ctx.lines.push('');
}

/**
 * Generate a unique function name
 */
function genFuncName(ctx: CodegenContext, prefix: string): string {
  ctx.counter++;
  return `${prefix}_${ctx.counter}`;
}

/**
 * Escape string for Python
 */
function pyStr(s: string): string {
  return JSON.stringify(s);  // JSON escaping works for Python strings
}

/**
 * Parse constraint string to extract values
 */
function parseConstraint(constraint: string, prefix: string): string | null {
  if (constraint.startsWith(prefix)) {
    return constraint.slice(prefix.length).trim();
  }
  return null;
}

/**
 * Generate validator for a type description
 * Returns the function name
 */
function generateValidator(desc: TypeDescription, ctx: CodegenContext): string {
  const name = desc.name;

  // Literal value
  if (name === 'Literal') {
    const val = desc.constraints?.[0]?.replace('equals ', '') ?? 'null';
    const funcName = genFuncName(ctx, 'validate_literal');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(value, path, issues):`);
    ctx.indent++;
    emit(ctx, `validate_literal(value, path, issues, ${val})`);
    ctx.indent--;
    return funcName;
  }

  // Pattern
  if (name === 'Pattern') {
    const pattern = desc.constraints?.[0]?.replace('matches ', '').replace(/^`|`$/g, '') ?? '';
    const funcName = genFuncName(ctx, 'validate_pattern');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(value, path, issues):`);
    ctx.indent++;
    emit(ctx, `validate_pattern(value, path, issues, ${pyStr(pattern)})`);
    ctx.indent--;
    return funcName;
  }

  // String
  if (name === 'String') {
    const args: string[] = [];
    for (const c of desc.constraints ?? []) {
      let val: string | null;
      if ((val = parseConstraint(c, 'minimum ')) && c.includes('character')) {
        args.push(`min_length=${val.split(' ')[0]}`);
      } else if ((val = parseConstraint(c, 'maximum ')) && c.includes('character')) {
        args.push(`max_length=${val.split(' ')[0]}`);
      } else if ((val = parseConstraint(c, 'matches '))) {
        // Remove backticks if present
        const pattern = val.replace(/^`|`$/g, '');
        args.push(`pattern=${pyStr(pattern)}`);
      }
    }
    if (args.length === 0) {
      return 'validate_str';  // Use prelude function directly
    }
    const funcName = genFuncName(ctx, 'validate_str');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(value, path, issues):`);
    ctx.indent++;
    emit(ctx, `validate_str(value, path, issues, ${args.join(', ')})`);
    ctx.indent--;
    return funcName;
  }

  // Number
  if (name === 'Number') {
    const args: string[] = [];
    for (const c of desc.constraints ?? []) {
      let val: string | null;
      if (c === 'integer') {
        args.push('integer=True');
      } else if ((val = parseConstraint(c, 'minimum '))) {
        args.push(`min_val=${val}`);
      } else if ((val = parseConstraint(c, 'maximum '))) {
        args.push(`max_val=${val}`);
      }
    }
    if (args.length === 0) {
      return 'validate_num';
    }
    const funcName = genFuncName(ctx, 'validate_num');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(value, path, issues):`);
    ctx.indent++;
    emit(ctx, `validate_num(value, path, issues, ${args.join(', ')})`);
    ctx.indent--;
    return funcName;
  }

  // Boolean
  if (name === 'Boolean') {
    return 'validate_bool';
  }

  // OneOf
  if (name === 'OneOf' && desc.oneOf) {
    const optionFuncs = desc.oneOf.map(opt => generateValidator(opt, ctx));
    const funcName = genFuncName(ctx, 'validate_oneof');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(value, path, issues):`);
    ctx.indent++;
    emit(ctx, `validate_oneof(value, path, issues, [`);
    ctx.indent++;
    for (const fn of optionFuncs) {
      emit(ctx, `${fn},`);
    }
    ctx.indent--;
    emit(ctx, `])`);
    ctx.indent--;
    return funcName;
  }

  // ListOf
  if (name === 'ListOf' && desc.itemType) {
    const itemFunc = generateValidator(desc.itemType, ctx);
    const args: string[] = [`item_validator=${itemFunc}`];
    for (const c of desc.constraints ?? []) {
      let val: string | null;
      if ((val = parseConstraint(c, 'minimum ')) && c.includes('items')) {
        args.push(`min_items=${val.split(' ')[0]}`);
      } else if ((val = parseConstraint(c, 'maximum ')) && c.includes('items')) {
        args.push(`max_items=${val.split(' ')[0]}`);
      }
    }
    const funcName = genFuncName(ctx, 'validate_list');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(value, path, issues):`);
    ctx.indent++;
    emit(ctx, `validate_list(value, path, issues, ${args.join(', ')})`);
    ctx.indent--;
    return funcName;
  }

  // Field
  if (name === 'Field' && desc.key) {
    const key = desc.key;
    const optional = desc.optional ?? false;

    // Determine value validator
    let valueFunc: string | null = null;
    if (desc.oneOf) {
      // Field with OneOf value
      const optionFuncs = desc.oneOf.map(opt => generateValidator(opt, ctx));
      valueFunc = genFuncName(ctx, 'validate_field_value');
      emitBlank(ctx);
      emit(ctx, `def ${valueFunc}(value, path, issues):`);
      ctx.indent++;
      emit(ctx, `validate_oneof(value, path, issues, [`);
      ctx.indent++;
      for (const fn of optionFuncs) {
        emit(ctx, `${fn},`);
      }
      ctx.indent--;
      emit(ctx, `])`);
      ctx.indent--;
    } else if (desc.itemType) {
      // Field with ListOf value
      valueFunc = generateValidator({ name: 'ListOf', itemType: desc.itemType, constraints: desc.constraints }, ctx);
    } else if (desc.children) {
      // Field with nested object
      valueFunc = generateObjectValidator(desc.children, ctx);
    } else if (desc.summary) {
      // Simple type referenced by summary
      valueFunc = generateValidator({ name: desc.summary, constraints: desc.constraints }, ctx);
    }

    const funcName = genFuncName(ctx, 'validate_field');
    emitBlank(ctx);
    emit(ctx, `def ${funcName}(obj, path, issues):`);
    ctx.indent++;
    const args = [`obj, path, issues, ${pyStr(key)}`];
    if (valueFunc) {
      args.push(`validator=${valueFunc}`);
    }
    if (optional) {
      args.push('optional=True');
    }
    emit(ctx, `validate_field(${args.join(', ')})`);
    ctx.indent--;
    return funcName;
  }

  // Object with children
  if ((name === 'Object' || name === 'JsonFile' || name === 'Directory' || name === 'Bundle') && desc.children) {
    return generateObjectValidator(desc.children, ctx);
  }

  // Unknown/custom type - generate placeholder
  const funcName = genFuncName(ctx, 'validate_unknown');
  emitBlank(ctx);
  emit(ctx, `def ${funcName}(value, path, issues):`);
  ctx.indent++;
  emit(ctx, `# TODO: Custom type '${name}' - implement validation`);
  emit(ctx, `pass`);
  ctx.indent--;
  return funcName;
}

/**
 * Generate validator for object children
 */
function generateObjectValidator(
  children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined },
  ctx: CodegenContext
): string {
  const requiredFuncs = (children.required ?? []).map(child => generateValidator(child, ctx));
  const optionalFuncs = (children.optional ?? []).map(child => {
    // Mark as optional for field generation
    return generateValidator({ ...child, optional: true }, ctx);
  });

  const funcName = genFuncName(ctx, 'validate_object');
  emitBlank(ctx);
  emit(ctx, `def ${funcName}(value, path, issues):`);
  ctx.indent++;
  emit(ctx, `if not validate_object(value, path, issues):`);
  ctx.indent++;
  emit(ctx, `return`);
  ctx.indent--;

  for (const fn of requiredFuncs) {
    emit(ctx, `${fn}(value, path, issues)`);
  }
  for (const fn of optionalFuncs) {
    emit(ctx, `${fn}(value, path, issues)`);
  }

  ctx.indent--;
  return funcName;
}

/**
 * Generate Python validator code from TypeDescription
 */
export function generatePython(desc: TypeDescription): string {
  // Load prelude
  const preludePath = path.join(__dirname, 'prelude.py');
  const prelude = fs.readFileSync(preludePath, 'utf-8');

  const ctx = createContext();

  // Generate validators
  const rootFunc = generateValidator(desc, ctx);

  // Build output
  const lines: string[] = [
    prelude,
    '',
    '# ' + '='.repeat(60),
    '# Generated Validators',
    '# ' + '='.repeat(60),
    ...ctx.lines,
    '',
    '# ' + '='.repeat(60),
    '# Root validator',
    '# ' + '='.repeat(60),
    '',
    'def validate_root(value):',
    '    """Validate value against the generated schema."""',
    `    return validate(value, ${rootFunc})`,
    '',
    '',
    'if __name__ == "__main__":',
    '    import json',
    '    import sys',
    '    ',
    '    if len(sys.argv) < 2:',
    '        print("Usage: python validator.py <json-file>")',
    '        sys.exit(1)',
    '    ',
    '    with open(sys.argv[1]) as f:',
    '        data = json.load(f)',
    '    ',
    '    result = validate_root(data)',
    '    print(json.dumps(result, indent=2))',
    '    sys.exit(0 if result["ok"] else 1)',
  ];

  return lines.join('\n');
}
