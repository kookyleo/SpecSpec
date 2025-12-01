// src/doc.ts
// Document generator for spec files

import { Type, Modifier, type TypeDescription } from './base.js';

/**
 * Check if a type description is "simple" (can be rendered inline)
 */
function isSimpleType(desc: TypeDescription): boolean {
  // Has nested structure = not simple
  if (desc.children && (desc.children.required?.length || desc.children.optional?.length)) {
    return false;
  }
  // OneOf with complex options = not simple
  if (desc.oneOf && desc.oneOf.some(opt => !isSimpleType(opt))) {
    return false;
  }
  // ListOf with complex item = not simple
  if (desc.itemType && !isSimpleType(desc.itemType)) {
    return false;
  }
  return true;
}

/**
 * Format a simple type as inline text
 */
function formatInline(desc: TypeDescription): string {
  // Literal values
  if (desc.name === 'Literal') {
    const val = desc.constraints?.[0]?.replace('equals ', '') ?? 'literal';
    return `\`${val}\``;
  }

  // Pattern (regex)
  if (desc.name === 'Pattern') {
    return desc.constraints?.[0] ?? 'pattern';
  }

  // OneOf with simple options
  if (desc.oneOf) {
    const options = desc.oneOf.map(formatInline);
    return options.join(' | ');
  }

  // ListOf
  if (desc.itemType) {
    const itemStr = formatInline(desc.itemType);
    const constraints = desc.constraints?.join(', ') ?? '';
    return `Array<${itemStr}>${constraints ? ` (${constraints})` : ''}`;
  }

  // Simple type with constraints
  let result = desc.summary ?? desc.name;
  if (desc.constraints && desc.constraints.length > 0) {
    result += ` (${desc.constraints.join(', ')})`;
  }
  return result;
}

/**
 * Render a type description as Markdown lines
 * @param desc - The type description
 * @param indent - Indentation level (0 = top level with headings, >0 = nested with bullets)
 * @param depth - Heading depth for nested sections
 */
function renderType(desc: TypeDescription, indent: number = 0, depth: number = 1): string[] {
  const lines: string[] = [];

  // Cap depth at 5 (##### is the max useful heading level), use bullets beyond
  const useHeadings = indent === 0 && depth <= 5;
  const effectiveIndent = useHeadings ? 0 : Math.max(indent, (depth - 5) * 2);
  const prefix = '  '.repeat(effectiveIndent);

  // Determine the display name
  const displayName = desc.key ?? desc.name;
  const optional = desc.optional ? ' *(optional)*' : '';

  // Simple type: render inline
  if (isSimpleType(desc)) {
    if (desc.key) {
      lines.push(`${prefix}- **\`${displayName}\`**${optional}: ${formatInline(desc)}`);
    } else if (useHeadings && depth === 1) {
      lines.push(`${'#'.repeat(depth)} ${displayName}`);
      lines.push('');
      if (desc.summary || desc.constraints) {
        lines.push(`**类型:** ${formatInline(desc)}`);
        lines.push('');
      }
    } else {
      lines.push(`${prefix}- ${formatInline(desc)}`);
    }
    return lines;
  }

  // Complex type: render with structure

  // Header for complex types
  if (desc.key) {
    let typeLabel = '';
    if (desc.name === 'JsonFile') {
      typeLabel = 'JSON 文件';
    } else if (desc.name === 'File') {
      typeLabel = '文件';
    } else if (desc.name === 'Directory') {
      typeLabel = '目录';
    } else if (desc.name === 'Object') {
      typeLabel = '对象';
    } else if (desc.name === 'ListOf') {
      typeLabel = '数组';
    } else if (desc.name === 'OneOf') {
      typeLabel = '多选一';
    }

    if (useHeadings) {
      lines.push(`${'#'.repeat(Math.min(depth, 5))} \`${displayName}\`${optional}`);
      lines.push('');
      if (typeLabel) {
        lines.push(`**类型:** ${typeLabel}`);
        lines.push('');
      }
    } else {
      lines.push(`${prefix}- **\`${displayName}\`**${optional}${typeLabel ? ': ' + typeLabel : ''}`);
    }
  } else if (useHeadings && depth === 1) {
    // Root type without key
    lines.push(`# ${displayName}`);
    lines.push('');
    if (desc.summary) {
      lines.push(`${desc.summary}`);
      lines.push('');
    }
  }

  // Constraints
  if (desc.constraints && desc.constraints.length > 0) {
    if (useHeadings) {
      lines.push('**约束:**');
      for (const c of desc.constraints) {
        lines.push(`- ${c}`);
      }
      lines.push('');
    } else {
      lines.push(`${prefix}  - 约束: ${desc.constraints.join(', ')}`);
    }
  }

  // OneOf options
  if (desc.oneOf && desc.oneOf.length > 0) {
    lines.push(...renderOneOf(desc.oneOf, effectiveIndent, depth));
  }

  // ListOf item type
  if (desc.itemType) {
    lines.push(...renderListOf(desc.itemType, effectiveIndent, depth));
  }

  // Children (required/optional fields)
  if (desc.children) {
    lines.push(...renderChildren(desc.children, effectiveIndent, depth));
  }

  return lines;
}

/**
 * Render OneOf options
 */
function renderOneOf(options: TypeDescription[], indent: number, depth: number): string[] {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);
  const allSimple = options.every(isSimpleType);
  const useHeadings = indent === 0 && depth < 5;

  if (allSimple) {
    const optsStr = options.map(formatInline).join(' | ');
    if (indent > 0) {
      lines.push(`${prefix}  - 可选: ${optsStr}`);
    } else {
      lines.push(`**可选值:** ${optsStr}`);
      lines.push('');
    }
  } else {
    if (indent > 0) {
      lines.push(`${prefix}  - **可选形态:**`);
    }

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const discLabel = findDiscriminator(opt) ?? opt.summary ?? opt.name;

      if (useHeadings) {
        lines.push(`${'#'.repeat(Math.min(depth + 1, 5))} 形态 ${i + 1}: ${discLabel}`);
        lines.push('');
        if (opt.children) {
          lines.push(...renderChildren(opt.children, 0, depth + 1));
        } else if (isSimpleType(opt)) {
          lines.push(formatInline(opt));
          lines.push('');
        }
      } else {
        lines.push(`${prefix}    - **${discLabel}**`);
        if (opt.children) {
          lines.push(...renderChildren(opt.children, indent + 3, depth + 1));
        } else if (isSimpleType(opt)) {
          lines.push(`${prefix}      - ${formatInline(opt)}`);
        }
      }
    }
  }

  return lines;
}

/**
 * Render ListOf item
 */
function renderListOf(itemType: TypeDescription, indent: number, depth: number): string[] {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);
  const useHeadings = indent === 0 && depth < 5;

  if (isSimpleType(itemType)) {
    if (indent > 0) {
      lines.push(`${prefix}  - 元素: ${formatInline(itemType)}`);
    } else {
      lines.push(`**元素类型:** ${formatInline(itemType)}`);
      lines.push('');
    }
  } else {
    if (useHeadings) {
      lines.push(`${'#'.repeat(Math.min(depth + 1, 5))} 元素结构`);
      lines.push('');
      lines.push(...renderType(itemType, 0, depth + 1));
    } else {
      lines.push(`${prefix}  - **元素结构:**`);
      lines.push(...renderType(itemType, indent + 2, depth + 1));
    }
  }

  return lines;
}

/**
 * Render children (required and optional)
 */
function renderChildren(
  children: { required?: TypeDescription[] | undefined; optional?: TypeDescription[] | undefined },
  indent: number,
  depth: number = 2
): string[] {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);
  const useHeadings = indent === 0 && depth <= 5;

  if (children.required && children.required.length > 0) {
    if (useHeadings) {
      lines.push(`${'#'.repeat(Math.min(depth, 5))} 必需字段`);
      lines.push('');
    } else {
      lines.push(`${prefix}  - **必需:**`);
    }

    for (const child of children.required) {
      lines.push(...renderType(child, useHeadings ? 0 : indent + 2, depth + 1));
    }

    if (useHeadings) lines.push('');
  }

  if (children.optional && children.optional.length > 0) {
    if (useHeadings) {
      lines.push(`${'#'.repeat(Math.min(depth, 5))} 可选字段`);
      lines.push('');
    } else {
      lines.push(`${prefix}  - **可选:**`);
    }

    for (const child of children.optional) {
      const optChild = { ...child, optional: true };
      lines.push(...renderType(optChild, useHeadings ? 0 : indent + 2, depth + 1));
    }

    if (useHeadings) lines.push('');
  }

  return lines;
}

/**
 * Try to find a discriminator label from a type description
 * (e.g., grant-type=authorization_code)
 */
function findDiscriminator(desc: TypeDescription): string | null {
  // Check summary for discriminator info
  if (desc.summary && desc.summary.includes('=')) {
    return desc.summary;
  }

  // Look in required fields for a literal/oneof field that could be a discriminator
  const required = desc.children?.required ?? [];
  for (const field of required) {
    if (field.key && field.oneOf) {
      // Field with OneOf that has only literals = discriminator candidate
      const allLiterals = field.oneOf.every(o => o.name === 'Literal');
      if (allLiterals && field.oneOf.length === 1) {
        const val = field.oneOf[0]!.constraints?.[0]?.replace('equals ', '') ?? '';
        return `${field.key}=${val}`;
      }
    }
  }

  return null;
}

/**
 * Generate Markdown documentation from a type description
 */
export function generateMarkdown(desc: TypeDescription): string {
  const lines = renderType(desc, 0);
  return lines.join('\n');
}

/**
 * Generate documentation from a root type
 */
export function generateDoc(root: Type | Modifier): string {
  const desc = root.describe();
  return generateMarkdown(desc);
}
