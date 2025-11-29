// src/descriptors/package.ts

import type { Descriptor, PackageDescriptorOptions } from '../types.js';

export class PackageDescriptor implements Descriptor<PackageDescriptorOptions> {
  constructor(public readonly opts: PackageDescriptorOptions) {}
}
