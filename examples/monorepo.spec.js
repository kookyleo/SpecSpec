// monorepo.spec.js
// Validates a monorepo structure with multiple packages

// Workspace package.json requirements
const WorkspacePackageJson = JsonFile({
  path: 'package.json',
  required: [
    Field({ key: 'name', value: Str() }),
    Field({ key: 'version', value: Str({ match: /^\d+\.\d+\.\d+/ }) }),
    Field({ key: 'private', value: Bool() }),
    Field({
      key: 'workspaces',
      value: ListOf(Str(), { min: 1 })
    }),
  ]
});

// Individual package requirements
const PackageJson = {
  required: [
    Field({ key: 'name', value: Str({ match: /^@[a-z]+\/[a-z-]+$/ }) }),
    Field({ key: 'version', value: Str() }),
  ],
  optional: [
    Field({ key: 'main', value: Str() }),
    Field({ key: 'types', value: Str() }),
    Field({
      key: 'dependencies',
      value: {
        optional: [] // Any dependencies allowed
      }
    }),
  ]
};

// Root monorepo structure
Directory({
  content: {
    required: [
      WorkspacePackageJson,
      Directory({ path: 'packages' }),
    ],
    optional: [
      File({ path: 'pnpm-workspace.yaml' }),
      File({ path: 'lerna.json', ext: 'json' }),
      File({ path: 'turbo.json', ext: 'json' }),
      Directory({ path: '.github' }),
    ]
  }
})
