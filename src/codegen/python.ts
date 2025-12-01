// src/codegen/python.ts
// Python code generator - generates Python validators from TypeDescription

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TypeDescription } from '../base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
 * Generate inline lambda expression for a type description
 * Returns a Python expression string that can be used as a validator
 */
function generateValidatorExpr(desc: TypeDescription): string {
  const name = desc.name;

  // Literal value
  if (name === 'Literal') {
    const val = desc.constraints?.[0]?.replace('equals ', '') ?? 'None';
    return `lambda v, p, i: validate_literal(v, p, i, ${val})`;
  }

  // Pattern
  if (name === 'Pattern') {
    const pattern = desc.constraints?.[0]?.replace('matches ', '').replace(/^`|`$/g, '') ?? '';
    return `lambda v, p, i: validate_pattern(v, p, i, ${pyStr(pattern)})`;
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
        const pattern = val.replace(/^`|`$/g, '');
        args.push(`pattern=${pyStr(pattern)}`);
      }
    }
    if (args.length === 0) {
      return 'validate_str';
    }
    return `lambda v, p, i: validate_str(v, p, i, ${args.join(', ')})`;
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
    return `lambda v, p, i: validate_num(v, p, i, ${args.join(', ')})`;
  }

  // Boolean
  if (name === 'Boolean') {
    return 'validate_bool';
  }

  // OneOf
  if (name === 'OneOf' && desc.oneOf) {
    const options = desc.oneOf.map(opt => generateValidatorExpr(opt));
    return `lambda v, p, i: validate_oneof(v, p, i, [${options.join(', ')}])`;
  }

  // ListOf
  if (name === 'ListOf' && desc.itemType) {
    const itemExpr = generateValidatorExpr(desc.itemType);
    const args: string[] = [`item_validator=${itemExpr}`];
    for (const c of desc.constraints ?? []) {
      let val: string | null;
      if ((val = parseConstraint(c, 'minimum ')) && c.includes('items')) {
        args.push(`min_items=${val.split(' ')[0]}`);
      } else if ((val = parseConstraint(c, 'maximum ')) && c.includes('items')) {
        args.push(`max_items=${val.split(' ')[0]}`);
      }
    }
    return `lambda v, p, i: validate_list(v, p, i, ${args.join(', ')})`;
  }

  // Field - generates a field validator call
  if (name === 'Field' && desc.key) {
    const key = desc.key;
    const optional = desc.optional ?? false;
    const args: string[] = [pyStr(key)];

    // Determine value validator
    let valueExpr: string | null = null;
    if (desc.oneOf) {
      const options = desc.oneOf.map(opt => generateValidatorExpr(opt));
      valueExpr = `lambda v, p, i: validate_oneof(v, p, i, [${options.join(', ')}])`;
    } else if (desc.itemType) {
      valueExpr = generateValidatorExpr({ name: 'ListOf', itemType: desc.itemType, constraints: desc.constraints });
    } else if (desc.children) {
      valueExpr = generateObjectExpr(desc.children);
    } else if (desc.summary) {
      valueExpr = generateValidatorExpr({ name: desc.summary, constraints: desc.constraints });
    }

    if (valueExpr) {
      args.push(`validator=${valueExpr}`);
    }
    if (optional) {
      args.push('optional=True');
    }
    return `lambda v, p, i: validate_field(v, p, i, ${args.join(', ')})`;
  }

  // Object with children
  if ((name === 'Object' || name === 'JsonFile' || name === 'Directory' || name === 'Bundle') && desc.children) {
    return generateObjectExpr(desc.children);
  }

  // Unknown/custom type - generate placeholder that passes
  return `(lambda v, p, i: None)`;
}

/**
 * Generate object validator expression
 */
function generateObjectExpr(
  children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
): string {
  const fieldExprs: string[] = [];

  for (const child of children.required ?? []) {
    fieldExprs.push(generateValidatorExpr(child));
  }
  for (const child of children.optional ?? []) {
    fieldExprs.push(generateValidatorExpr({ ...child, optional: true }));
  }

  if (fieldExprs.length === 0) {
    return 'validate_object';
  }

  // Generate a lambda that validates object and all fields
  const fieldCalls = fieldExprs.map(expr => `(${expr})(v, p, i)`).join(', ');
  return `lambda v, p, i: validate_object(v, p, i) and [${fieldCalls}]`;
}

/**
 * Generate Python validator code from TypeDescription
 */
export function generatePython(desc: TypeDescription): string {
  // Load prelude
  const preludePath = path.join(__dirname, 'prelude.py');
  const prelude = fs.readFileSync(preludePath, 'utf-8');

  // Generate root validator expression
  const rootExpr = generateValidatorExpr(desc);

  // Build output
  const lines: string[] = [
    prelude,
    '',
    '# ' + '='.repeat(60),
    '# Generated Schema',
    '# ' + '='.repeat(60),
    '',
    `_root_validator = ${rootExpr}`,
    '',
    '',
    'def validate_root(value):',
    '    """Validate value against the generated schema."""',
    '    return validate(value, _root_validator)',
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
