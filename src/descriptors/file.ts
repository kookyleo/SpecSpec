// src/descriptors/file.ts

import type { Descriptor, FileDescriptorOptions } from '../types.js';

export class FileDescriptor implements Descriptor<FileDescriptorOptions> {
  constructor(public readonly opts: FileDescriptorOptions) {}
}
