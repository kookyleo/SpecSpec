// src/descriptors/field.ts

import type { Descriptor, FieldDescriptorOptions } from '../types.js';

export class FieldDescriptor implements Descriptor<FieldDescriptorOptions> {
  public readonly opts: FieldDescriptorOptions;

  constructor(opts: FieldDescriptorOptions) {
    this.opts = { required: false, ...opts };
  }
}
