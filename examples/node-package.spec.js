// node-package.spec.js
// Validates a typical Node.js package structure

// Reusable field definitions
const NameField = Field({ key: 'name', value: Str({ minLength: 1 }) });
const VersionField = Field({ key: 'version', value: Str({ match: /^\d+\.\d+\.\d+/ }) });
const DescField = Field({ key: 'description', value: Str(), optional: true });
const MainField = Field({ key: 'main', value: Str(), optional: true });
const TypesField = Field({ key: 'types', value: Str(), optional: true });

// Scripts object - all script fields are optional
const ScriptsField = Field({
  key: 'scripts',
  value: {
    optional: [
      Field({ key: 'build', value: Str(), optional: true }),
      Field({ key: 'test', value: Str(), optional: true }),
      Field({ key: 'lint', value: Str(), optional: true }),
      Field({ key: 'start', value: Str(), optional: true }),
    ]
  },
  optional: true
});

// License field - common license types
const LicenseField = Field({
  key: 'license',
  value: OneOf('MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause', 'GPL-3.0', Str()),
  optional: true
});

// Root directory spec
Directory({
  content: {
    required: [
      JsonFile({
        path: 'package.json',
        required: [NameField, VersionField],
        optional: [DescField, MainField, TypesField, ScriptsField, LicenseField]
      })
    ],
    optional: [
      File({ path: 'README.md' }),
      File({ path: 'LICENSE' }),
      File({ path: 'tsconfig.json', ext: 'json' }),
      Directory({ path: 'src' }),
      Directory({ path: 'dist' }),
      Directory({ path: 'test' }),
    ]
  }
})
