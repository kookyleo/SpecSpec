// Test spec using OptionalField
Package({
  withSpec: () => Spec('Package with Optional Field', [
    $.Contains.File({
      path: 'manifest.json',
      withSpec: () => Spec('Manifest', [
        $.Is.JSON(),
        $.Has.OptionalField({ key: 'name' }),
        $.Has.OptionalField({ key: 'description' }),
      ])
    })
  ])
})
