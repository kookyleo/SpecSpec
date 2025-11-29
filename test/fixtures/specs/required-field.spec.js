// Test spec using RequiredField
Package({
  withSpec: () => Spec('Package with Required Field', [
    $.Contains.File({
      path: 'manifest.json',
      withSpec: () => Spec('Manifest', [
        $.Is.JSON(),
        $.Has.RequiredField({ key: 'name' }),
      ])
    })
  ])
})
