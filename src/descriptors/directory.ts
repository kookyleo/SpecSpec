// src/descriptors/directory.ts

import type { Descriptor, DirectoryDescriptorOptions } from '../types.js';

export class DirectoryDescriptor implements Descriptor<DirectoryDescriptorOptions> {
  constructor(public readonly opts: DirectoryDescriptorOptions = {}) {}
}
