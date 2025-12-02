// test/codegen.test.ts

import { describe, it, expect } from 'vitest';
import { generatePython } from '../dist/codegen/python/generator.js';
import { generateTypeScript } from '../dist/codegen/typescript/generator.js';
import { generateSwift } from '../dist/codegen/swift/generator.js';
import { generateRust } from '../dist/codegen/rust/generator.js';
import type { TypeDescription } from '../dist/base.js';

describe('Code generators', () => {
  const descWithDescription: TypeDescription = {
    name: 'Object',
    description: 'User profile validation schema',
    children: {
      required: [
        { name: 'Field', key: 'name', summary: 'String' },
        { name: 'Field', key: 'age', summary: 'Number' },
      ],
    },
  };

  const descWithoutDescription: TypeDescription = {
    name: 'Object',
    children: {
      required: [
        { name: 'Field', key: 'id', summary: 'String' },
      ],
    },
  };

  describe('Python generator', () => {
    it('outputs description as comment when present', () => {
      const code = generatePython(descWithDescription);
      expect(code).toContain('# User profile validation schema');
      expect(code).toContain('# Generated Schema');
    });

    it('does not add empty comment when description absent', () => {
      const code = generatePython(descWithoutDescription);
      expect(code).toContain('# Generated Schema');
      expect(code).not.toContain('# \n# ');
    });

    it('handles multiline description', () => {
      const desc: TypeDescription = {
        name: 'String',
        description: 'Line one\nLine two\nLine three',
      };
      const code = generatePython(desc);
      expect(code).toContain('# Line one');
      expect(code).toContain('# Line two');
      expect(code).toContain('# Line three');
    });
  });

  describe('TypeScript generator', () => {
    it('outputs description as comment when present', () => {
      const code = generateTypeScript(descWithDescription);
      expect(code).toContain('// User profile validation schema');
      expect(code).toContain('// Generated Schema');
    });

    it('does not add empty comment when description absent', () => {
      const code = generateTypeScript(descWithoutDescription);
      expect(code).toContain('// Generated Schema');
    });
  });

  describe('Swift generator', () => {
    it('outputs description as comment when present', () => {
      const code = generateSwift(descWithDescription);
      expect(code).toContain('// User profile validation schema');
      expect(code).toContain('// Generated Schema');
    });

    it('does not add empty comment when description absent', () => {
      const code = generateSwift(descWithoutDescription);
      expect(code).toContain('// Generated Schema');
    });
  });

  describe('Rust generator', () => {
    it('outputs description as comment when present', () => {
      const code = generateRust(descWithDescription);
      expect(code).toContain('// User profile validation schema');
      expect(code).toContain('// Generated Schema');
    });

    it('does not add empty comment when description absent', () => {
      const code = generateRust(descWithoutDescription);
      expect(code).toContain('// Generated Schema');
    });
  });
});

describe('Code generator validation logic', () => {
  describe('Field validation', () => {
    it('generates field validator with key', () => {
      const desc: TypeDescription = {
        name: 'Field',
        key: 'username',
        summary: 'String',
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('validate_field');
      expect(pyCode).toContain('"username"');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('validateField');
      expect(tsCode).toContain('"username"');
    });

    it('generates optional field validator', () => {
      const desc: TypeDescription = {
        name: 'Field',
        key: 'nickname',
        summary: 'String',
        optional: true,
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('optional=True');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('optional: true');
    });
  });

  describe('String validation', () => {
    it('generates string validator with constraints', () => {
      const desc: TypeDescription = {
        name: 'String',
        constraints: ['minimum 3 characters', 'maximum 20 characters'],
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('min_length=3');
      expect(pyCode).toContain('max_length=20');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('minLength: 3');
      expect(tsCode).toContain('maxLength: 20');
    });

    it('generates pattern constraint', () => {
      const desc: TypeDescription = {
        name: 'String',
        constraints: ['matches `/^[a-z]+$/`'],
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('pattern=');
      expect(pyCode).toContain('^[a-z]+$');
    });
  });

  describe('Number validation', () => {
    it('generates number validator with range', () => {
      const desc: TypeDescription = {
        name: 'Number',
        constraints: ['minimum 0', 'maximum 100'],
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('min_val=0');
      expect(pyCode).toContain('max_val=100');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('min: 0');
      expect(tsCode).toContain('max: 100');
    });

    it('generates integer constraint', () => {
      const desc: TypeDescription = {
        name: 'Number',
        constraints: ['integer'],
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('integer=True');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('integer: true');
    });
  });

  describe('OneOf validation', () => {
    it('generates oneof validator', () => {
      const desc: TypeDescription = {
        name: 'OneOf',
        oneOf: [
          { name: 'Literal', constraints: ['equals "a"'] },
          { name: 'Literal', constraints: ['equals "b"'] },
        ],
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('validate_oneof');
      expect(pyCode).toContain('"a"');
      expect(pyCode).toContain('"b"');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('validateOneOf');
    });
  });

  describe('ListOf validation', () => {
    it('generates list validator with constraints', () => {
      const desc: TypeDescription = {
        name: 'ListOf',
        itemType: { name: 'String' },
        constraints: ['minimum 1 items', 'maximum 10 items'],
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('validate_list');
      expect(pyCode).toContain('min_items=1');
      expect(pyCode).toContain('max_items=10');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('validateList');
      expect(tsCode).toContain('minItems: 1');
      expect(tsCode).toContain('maxItems: 10');
    });
  });

  describe('FS item description comments', () => {
    it('generates comments for JsonFile with description', () => {
      const desc: TypeDescription = {
        name: 'Bundle',
        fsType: 'bundle',
        accept: [{ name: 'Directory', fsType: 'directory' }],
        children: {
          required: [
            {
              name: 'JsonFile',
              fsType: 'jsonFile',
              filePath: 'config.json',
              description: 'Main configuration file',
            },
          ],
        },
      };

      const pyCode = generatePython(desc);
      expect(pyCode).toContain('# Main configuration file');

      const tsCode = generateTypeScript(desc);
      expect(tsCode).toContain('/* Main configuration file */');

      const swiftCode = generateSwift(desc);
      expect(swiftCode).toContain('/* Main configuration file */');

      const rustCode = generateRust(desc);
      expect(rustCode).toContain('/* Main configuration file */');
    });

    it('does not add comment when description is absent', () => {
      const desc: TypeDescription = {
        name: 'Bundle',
        fsType: 'bundle',
        accept: [{ name: 'Directory', fsType: 'directory' }],
        children: {
          required: [
            {
              name: 'JsonFile',
              fsType: 'jsonFile',
              filePath: 'data.json',
            },
          ],
        },
      };

      const pyCode = generatePython(desc);
      expect(pyCode).not.toContain('# validate_json_file');
      expect(pyCode).toContain('validate_json_file');
    });
  });
});
