// SpecSpec/src/descriptors/type.mjs
// Type Descriptors (for $.Is.OneOf)

export class DirectoryDescriptor {
  execute(engine, context) {
    return context.stat && context.stat.isDirectory();
  }
}

export class FileTypeDescriptor {
  constructor(opts) {
    this.opts = opts;
  }

  execute(engine, context) {
    if (!context.stat || !context.stat.isFile()) return false;
    if (this.opts?.withExtension) {
      const ext = '.' + this.opts.withExtension.replace(/^\./, '');
      if (!context.path.endsWith(ext)) return false;
    }
    return true;
  }
}
