// src/doc.ts
// Document generator for spec files

import { Type, Modifier, type TypeDescription } from './base.js';

/**
 * Generate Markdown documentation from a type description
 */
export function generateMarkdown(desc: TypeDescription, level = 1): string {
  const lines: string[] = [];

  // Title
  const title = desc.key ? `${desc.key}` : desc.name;
  if (level === 1) {
    lines.push(`# ${title}`);
  } else if (level === 2) {
    lines.push(`## ${title}`);
  } else {
    lines.push(`${'#'.repeat(Math.min(level, 6))} ${title}`);
  }
  lines.push('');

  // Type and constraints
  const typeInfo: string[] = [];
  if (desc.summary) {
    typeInfo.push(`**Type:** ${desc.summary}`);
  } else if (desc.name !== 'Field' && desc.name !== 'Directory' && desc.name !== 'JsonFile') {
    typeInfo.push(`**Type:** ${desc.name}`);
  }

  if (desc.optional) {
    typeInfo.push('*(optional)*');
  }

  if (typeInfo.length > 0) {
    lines.push(typeInfo.join(' '));
    lines.push('');
  }

  // Constraints
  if (desc.constraints && desc.constraints.length > 0) {
    lines.push('**Constraints:**');
    for (const c of desc.constraints) {
      lines.push(`- ${c}`);
    }
    lines.push('');
  }

  // OneOf options
  if (desc.oneOf && desc.oneOf.length > 0) {
    lines.push('**One of:**');
    for (const opt of desc.oneOf) {
      const optDesc = formatInlineType(opt);
      lines.push(`- ${optDesc}`);
    }
    lines.push('');
  }

  // ListOf item type
  if (desc.itemType) {
    const itemDesc = formatInlineType(desc.itemType);
    lines.push(`**Items:** ${itemDesc}`);
    lines.push('');
  }

  // Children (required/optional fields)
  if (desc.children) {
    if (desc.children.required && desc.children.required.length > 0) {
      lines.push(`### Required`);
      lines.push('');
      for (const child of desc.children.required) {
        lines.push(generateChildMarkdown(child, level + 1));
      }
    }

    if (desc.children.optional && desc.children.optional.length > 0) {
      lines.push(`### Optional`);
      lines.push('');
      for (const child of desc.children.optional) {
        lines.push(generateChildMarkdown({ ...child, optional: true }, level + 1));
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate markdown for a child item (field, file, etc.)
 */
function generateChildMarkdown(desc: TypeDescription, _level: number): string {
  const lines: string[] = [];

  // Field/file name
  const name = desc.key ?? desc.name;
  const optional = desc.optional ? ' *(optional)*' : '';

  // Type description
  let typeDesc = '';
  if (desc.summary) {
    typeDesc = desc.summary;
  } else if (desc.oneOf) {
    typeDesc = 'OneOf: ' + desc.oneOf.map(formatInlineType).join(' | ');
  } else if (desc.itemType) {
    typeDesc = `ListOf(${formatInlineType(desc.itemType)})`;
  } else if (desc.name === 'JsonFile') {
    typeDesc = 'JSON File';
  } else if (desc.name === 'File') {
    typeDesc = 'File';
  } else if (desc.name === 'Directory') {
    typeDesc = 'Directory';
  }

  // Constraints
  const constraintStr = desc.constraints ? ` - ${desc.constraints.join(', ')}` : '';

  lines.push(`- **\`${name}\`**${optional}: ${typeDesc}${constraintStr}`);

  // Nested children
  if (desc.children) {
    if (desc.children.required && desc.children.required.length > 0) {
      lines.push('  - Required fields:');
      for (const child of desc.children.required) {
        lines.push('    ' + formatNestedChild(child));
      }
    }
    if (desc.children.optional && desc.children.optional.length > 0) {
      lines.push('  - Optional fields:');
      for (const child of desc.children.optional) {
        lines.push('    ' + formatNestedChild({ ...child, optional: true }));
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format nested child as inline text
 */
function formatNestedChild(desc: TypeDescription): string {
  const name = desc.key ?? desc.name;
  const optional = desc.optional ? ' *(optional)*' : '';
  const typeDesc = desc.summary ?? formatInlineType(desc);
  const constraintStr = desc.constraints ? ` - ${desc.constraints.join(', ')}` : '';
  return `- \`${name}\`${optional}: ${typeDesc}${constraintStr}`;
}

/**
 * Format a type description as inline text
 */
function formatInlineType(desc: TypeDescription): string {
  if (desc.name === 'Literal') {
    return desc.constraints?.[0]?.replace('equals ', '') ?? 'literal';
  }
  if (desc.name === 'Pattern') {
    return desc.constraints?.[0] ?? 'pattern';
  }
  if (desc.oneOf) {
    return desc.oneOf.map(formatInlineType).join(' | ');
  }
  if (desc.itemType) {
    return `ListOf(${formatInlineType(desc.itemType)})`;
  }

  let result = desc.name;
  if (desc.constraints && desc.constraints.length > 0) {
    result += ` (${desc.constraints.join(', ')})`;
  }
  return result;
}

/**
 * Generate JSON schema-like documentation
 */
export function generateJson(desc: TypeDescription): object {
  return desc;
}

/**
 * Generate documentation from a root type
 */
export function generateDoc(
  root: Type | Modifier,
  format: 'markdown' | 'json' = 'markdown'
): string {
  const desc = root.describe();

  if (format === 'json') {
    return JSON.stringify(generateJson(desc), null, 2);
  }

  return generateMarkdown(desc);
}
