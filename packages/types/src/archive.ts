// src/archive.ts
// Archive file types: ZipFile, TarFile

import fs from 'node:fs';
import path from 'node:path';
import { Type, type Context, type TypeDescription } from '@specspec/core';

// ═══════════════════════════════════════════════════════════════
// Helper: Magic number detection
// ═══════════════════════════════════════════════════════════════

function readMagic(filePath: string, length: number): Buffer | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, 0);
    fs.closeSync(fd);
    return buf;
  } catch {
    return null;
  }
}

function isZipSignature(bytes: Buffer | null): boolean {
  if (!bytes || bytes.length < 4) return false;
  const [b0, b1, b2, b3] = bytes;
  if (b0 !== 0x50 || b1 !== 0x4b) return false; // 'PK'
  return (
    (b2 === 0x03 && b3 === 0x04) || // Local file header
    (b2 === 0x05 && b3 === 0x06) || // Empty archive
    (b2 === 0x07 && b3 === 0x08)    // Spanned archive
  );
}

function isTarSignature(bytes: Buffer | null): boolean {
  if (!bytes || bytes.length < 262) return false;
  // Check for "ustar" magic at offset 257
  const magic = bytes.slice(257, 262).toString('ascii');
  return magic === 'ustar';
}

function isGzipSignature(bytes: Buffer | null): boolean {
  if (!bytes || bytes.length < 2) return false;
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

// ═══════════════════════════════════════════════════════════════
// ZipFile - ZIP archive validation
// ═══════════════════════════════════════════════════════════════

export interface ZipFileSpec {
  /** Required file extension (without dot) */
  ext?: string;
}

export class ZipFileType extends Type<ZipFileSpec | undefined, string> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'string') {
      ctx.addIssue('type.mismatch', `Expected path string, got ${typeof value}`);
      return;
    }

    // Check file exists
    let stat: fs.Stats;
    try {
      stat = fs.statSync(value);
    } catch {
      ctx.addIssue('file.not_found', `File not found: ${value}`);
      return;
    }

    if (!stat.isFile()) {
      ctx.addIssue('file.not_file', `Not a file: ${value}`);
      return;
    }

    // Check extension
    if (this.spec?.ext) {
      const ext = path.extname(value).slice(1);
      if (ext !== this.spec.ext) {
        ctx.addIssue('file.wrong_ext', `Expected extension .${this.spec.ext}, got .${ext}`);
        return;
      }
    }

    // Verify ZIP signature
    const magic = readMagic(value, 4);
    if (!isZipSignature(magic)) {
      ctx.addIssue('zip.invalid', 'File is not a valid ZIP archive.');
    }
  }

  matches(value: unknown, _ctx: Context): boolean {
    if (typeof value !== 'string') return false;
    try {
      const stat = fs.statSync(value);
      if (!stat.isFile()) return false;
      if (this.spec?.ext) {
        const ext = path.extname(value).slice(1);
        if (ext !== this.spec.ext) return false;
      }
      return isZipSignature(readMagic(value, 4));
    } catch {
      return false;
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = ['ZIP format'];
    if (this.spec?.ext) {
      constraints.push(`extension: .${this.spec.ext}`);
    }
    return {
      name: 'ZipFile',
      summary: 'ZIP Archive',
      constraints,
    };
  }
}

const defaultZipFile = new ZipFileType(undefined);

/** ZipFile type factory */
export const ZipFile: {
  (spec?: ZipFileSpec): ZipFileType;
  _default: ZipFileType;
} = Object.assign(
  (spec?: ZipFileSpec) => spec ? new ZipFileType(spec) : defaultZipFile,
  { _default: defaultZipFile }
);

// ═══════════════════════════════════════════════════════════════
// TarFile - TAR archive validation (including .tar.gz)
// ═══════════════════════════════════════════════════════════════

export interface TarFileSpec {
  /** Required file extension (without dot) */
  ext?: string;
  /** Allow gzipped tar */
  gzip?: boolean;
}

export class TarFileType extends Type<TarFileSpec | undefined, string> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'string') {
      ctx.addIssue('type.mismatch', `Expected path string, got ${typeof value}`);
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(value);
    } catch {
      ctx.addIssue('file.not_found', `File not found: ${value}`);
      return;
    }

    if (!stat.isFile()) {
      ctx.addIssue('file.not_file', `Not a file: ${value}`);
      return;
    }

    // Check extension
    if (this.spec?.ext) {
      const ext = path.extname(value).slice(1);
      if (ext !== this.spec.ext) {
        ctx.addIssue('file.wrong_ext', `Expected extension .${this.spec.ext}, got .${ext}`);
        return;
      }
    }

    // Check magic
    const magic = readMagic(value, 262);
    const isGzip = isGzipSignature(magic);
    const isTar = isTarSignature(magic);

    if (isGzip) {
      if (this.spec?.gzip === false) {
        ctx.addIssue('tar.no_gzip', 'Gzipped TAR files not allowed.');
        return;
      }
      // Can't easily verify TAR inside gzip without decompressing
    } else if (!isTar) {
      ctx.addIssue('tar.invalid', 'File is not a valid TAR archive.');
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = ['TAR format'];
    if (this.spec?.gzip !== false) {
      constraints.push('gzip allowed');
    }
    if (this.spec?.ext) {
      constraints.push(`extension: .${this.spec.ext}`);
    }
    return {
      name: 'TarFile',
      summary: 'TAR Archive',
      constraints,
    };
  }
}

const defaultTarFile = new TarFileType(undefined);

/** TarFile type factory */
export const TarFile: {
  (spec?: TarFileSpec): TarFileType;
  _default: TarFileType;
} = Object.assign(
  (spec?: TarFileSpec) => spec ? new TarFileType(spec) : defaultTarFile,
  { _default: defaultTarFile }
);
