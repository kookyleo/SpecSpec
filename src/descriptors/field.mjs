// src/descriptors/field.mjs
// FieldDescriptor - pure data

export class FieldDescriptor {
  constructor(opts) {
    this.opts = { required: false, ...opts };
  }
}
