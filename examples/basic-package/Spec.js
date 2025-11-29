// examples/basic-package/Spec.js
// A basic example of a package specification

Package({
  withSpec: () => Spec('Basic Package Specification', [

    // Package must contain a manifest.json file
    $.Contains.File({
      path: 'manifest.json',
      withSpec: () => Spec('Manifest Rules', [
        // Must be valid JSON
        $.Is.JSON(),

        // Required fields
        $.Has.RequiredField({ key: 'name' }),
        $.Has.RequiredField({ key: 'version' }),

        // Optional fields
        $.Has.OptionalField({ key: 'description' }),
        $.Has.OptionalField({ key: 'author' }),

        // Nested field validation
        $.Has.Field({
          key: 'name',
          withSpec: () => Spec('Name Rules', [
            $.Is.String(),
            $.Is.Not.Empty()
          ])
        })
      ])
    }),

    // Must not contain debug files
    $.DoesNot.Contain(File({ path: 'debug.log' })),
    $.DoesNot.Contain(File({ path: '.env' }))
  ])
})
