// Intentional syntax error for testing
Package({
  withSpec: () => Spec('Broken', [
    $.Is.JSON(  // missing closing paren
  ])
})
