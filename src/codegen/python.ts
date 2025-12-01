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
 * Generate inline lambda expression for a data type description
 * Returns a Python expression string that can be used as a validator
 */
function generateDataValidatorExpr(desc: TypeDescription): string {
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
    const options = desc.oneOf.map(opt => generateDataValidatorExpr(opt));
    return `lambda v, p, i: validate_oneof(v, p, i, [${options.join(', ')}])`;
  }

  // ListOf
  if (name === 'ListOf' && desc.itemType) {
    const itemExpr = generateDataValidatorExpr(desc.itemType);
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
      const options = desc.oneOf.map(opt => generateDataValidatorExpr(opt));
      valueExpr = `lambda v, p, i: validate_oneof(v, p, i, [${options.join(', ')}])`;
    } else if (desc.itemType) {
      valueExpr = generateDataValidatorExpr({ name: 'ListOf', itemType: desc.itemType, constraints: desc.constraints });
    } else if (desc.children) {
      valueExpr = generateObjectExpr(desc.children);
    } else if (desc.summary) {
      valueExpr = generateDataValidatorExpr({ name: desc.summary, constraints: desc.constraints });
    }

    if (valueExpr) {
      args.push(`validator=${valueExpr}`);
    }
    if (optional) {
      args.push('optional=True');
    }
    return `lambda v, p, i: validate_field(v, p, i, ${args.join(', ')})`;
  }

  // Object with children (data object, not file system)
  if (name === 'Object' && desc.children) {
    return generateObjectExpr(desc.children);
  }

  // Unknown/custom type - generate placeholder that passes
  return `(lambda v, p, i: None)`;
}

/**
 * Generate object validator expression (for data objects)
 */
function generateObjectExpr(
  children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
): string {
  const fieldExprs: string[] = [];

  for (const child of children.required ?? []) {
    fieldExprs.push(generateDataValidatorExpr(child));
  }
  for (const child of children.optional ?? []) {
    fieldExprs.push(generateDataValidatorExpr({ ...child, optional: true }));
  }

  if (fieldExprs.length === 0) {
    return 'validate_object';
  }

  // Generate a lambda that validates object and all fields
  const fieldCalls = fieldExprs.map(expr => `(${expr})(v, p, i)`).join(', ');
  return `lambda v, p, i: validate_object(v, p, i) and [${fieldCalls}]`;
}

/**
 * Generate bundle content validator (for file system children)
 */
function generateBundleContentExpr(
  children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined }
): string {
  const parts: string[] = [];

  for (const child of children.required ?? []) {
    parts.push(generateFSChildExpr(child, false));
  }
  for (const child of children.optional ?? []) {
    parts.push(generateFSChildExpr(child, true));
  }

  if (parts.length === 0) {
    return 'lambda ctx, p, i: None';
  }

  const calls = parts.join(', ');
  return `lambda ctx, p, i: [${calls}]`;
}

/**
 * Generate file system child validator expression
 */
function generateFSChildExpr(desc: TypeDescription, _optional: boolean): string {
  const fsType = desc.fsType;

  // JsonFile
  if (fsType === 'jsonFile' && desc.filePath) {
    const contentExpr = desc.children ? generateObjectExpr(desc.children) : 'None';
    return `validate_json_file(ctx, ${pyStr(desc.filePath)}, p, i, content_validator=${contentExpr})`;
  }

  // File
  if (fsType === 'file' && desc.filePath) {
    const ext = desc.fileExt ? `, ext=${pyStr(desc.fileExt)}` : '';
    return `validate_fs_file(ctx, ${pyStr(desc.filePath)}, p, i${ext})`;
  }

  // Directory
  if (fsType === 'directory' && desc.filePath) {
    return `validate_fs_directory(ctx, ${pyStr(desc.filePath)}, p, i)`;
  }

  // Unknown file system type
  return 'None';
}

/**
 * Generate bundle validator expression
 */
function generateBundleExpr(desc: TypeDescription): string {
  const args: string[] = [];

  // Parse accept types
  let acceptDir = false;
  let acceptZip = false;
  let zipExt: string | undefined;

  for (const accept of desc.accept ?? []) {
    if (accept.fsType === 'directory' || accept.name === 'Directory') {
      acceptDir = true;
    }
    if (accept.fsType === 'zipFile' || accept.name === 'ZipFile') {
      acceptZip = true;
      zipExt = accept.fileExt;
    }
  }

  args.push(`accept_dir=${acceptDir ? 'True' : 'False'}`);
  args.push(`accept_zip=${acceptZip ? 'True' : 'False'}`);
  if (zipExt) {
    args.push(`zip_ext=${pyStr(zipExt)}`);
  }

  // Name pattern
  if (desc.namePattern) {
    args.push(`name_pattern=${pyStr(desc.namePattern)}`);
  }

  // Content validator
  if (desc.children) {
    const contentExpr = generateBundleContentExpr(desc.children);
    args.push(`content_validator=${contentExpr}`);
  }

  return `lambda path, p, i: validate_bundle(path, p, i, ${args.join(', ')})`;
}

/**
 * Generate Python validator code from TypeDescription
 */
export function generatePython(desc: TypeDescription): string {
  // Load prelude
  const preludePath = path.join(__dirname, 'prelude.py');
  const prelude = fs.readFileSync(preludePath, 'utf-8');

  const isBundle = desc.fsType === 'bundle';

  // Generate root validator expression
  let rootExpr: string;
  let mainCode: string;

  if (isBundle) {
    rootExpr = generateBundleExpr(desc);
    mainCode = `
def validate_root(path: str) -> dict:
    """Validate a bundle (directory or zip file) against the schema."""
    return validate_path(path, _root_validator)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python validator.py <bundle-path>")
        sys.exit(1)

    result = validate_root(sys.argv[1])
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["ok"] else 1)`;
  } else {
    rootExpr = generateDataValidatorExpr(desc);
    mainCode = `
def validate_root(value) -> dict:
    """Validate value against the generated schema."""
    return validate(value, _root_validator)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python validator.py <json-file>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        data = json.load(f)

    result = validate_root(data)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["ok"] else 1)`;
  }

  // Build output
  const lines: string[] = [
    prelude,
    '',
    '# ' + '='.repeat(60),
    '# Generated Schema',
    '# ' + '='.repeat(60),
    '',
    `_root_validator = ${rootExpr}`,
    mainCode,
  ];

  return lines.join('\n');
}
