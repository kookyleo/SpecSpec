// src/strings.ts
// Extended string types: SemVer, Url, Path

import { Type, type Context, type TypeDescription } from '@specspec/core';

// ═══════════════════════════════════════════════════════════════
// SemVer - Semantic version string
// ═══════════════════════════════════════════════════════════════

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export class SemVerType extends Type<void, string> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'string') {
      ctx.addIssue('type.mismatch', `Expected string, got ${typeof value}`);
      return;
    }
    if (!SEMVER_RE.test(value)) {
      ctx.addIssue('semver.invalid', `Value "${value}" is not a valid semantic version.`);
    }
  }

  describe(): TypeDescription {
    return {
      name: 'SemVer',
      summary: 'Semantic Version',
      constraints: ['format: MAJOR.MINOR.PATCH[-prerelease][+build]'],
    };
  }
}

/** Semantic version singleton */
export const SemVer = new SemVerType(undefined as void);

// ═══════════════════════════════════════════════════════════════
// Url - URL validation with protocol/host constraints
// ═══════════════════════════════════════════════════════════════

export interface UrlSpec {
  /** Required protocol (e.g., 'https', 'http') */
  protocol?: string;
  /** Allowed hostnames */
  allowedHosts?: string[];
}

export class UrlType extends Type<UrlSpec | undefined, string> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'string') {
      ctx.addIssue('type.mismatch', `Expected string, got ${typeof value}`);
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue('url.invalid', `Value "${value}" is not a valid URL.`);
      return;
    }

    const spec = this.spec;
    if (spec?.protocol) {
      const expectedProto = spec.protocol.endsWith(':') ? spec.protocol : `${spec.protocol}:`;
      if (parsed.protocol !== expectedProto) {
        ctx.addIssue('url.protocol_mismatch', `Expected protocol ${spec.protocol}, got ${parsed.protocol.slice(0, -1)}.`);
      }
    }

    if (spec?.allowedHosts && spec.allowedHosts.length > 0) {
      if (!spec.allowedHosts.includes(parsed.hostname)) {
        ctx.addIssue('url.host_not_allowed', `Host "${parsed.hostname}" is not in allowed list: ${spec.allowedHosts.join(', ')}.`);
      }
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.protocol) {
      constraints.push(`protocol: ${this.spec.protocol}`);
    }
    if (this.spec?.allowedHosts && this.spec.allowedHosts.length > 0) {
      constraints.push(`hosts: ${this.spec.allowedHosts.join(', ')}`);
    }
    return {
      name: 'Url',
      summary: 'URL',
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }
}

const defaultUrl = new UrlType(undefined);

/** URL type factory */
export const Url: {
  (spec?: UrlSpec): UrlType;
  _default: UrlType;
} = Object.assign(
  (spec?: UrlSpec) => spec ? new UrlType(spec) : defaultUrl,
  { _default: defaultUrl }
);

// ═══════════════════════════════════════════════════════════════
// Path - Path string validation
// ═══════════════════════════════════════════════════════════════

export interface PathSpec {
  /** Path style: 'unix', 'windows', or 'any' (default) */
  style?: 'unix' | 'windows' | 'any';
  /** Must be absolute path */
  absolute?: boolean;
  /** Must be relative path */
  relative?: boolean;
}

export class PathType extends Type<PathSpec | undefined, string> {
  validate(value: unknown, ctx: Context): void {
    if (typeof value !== 'string') {
      ctx.addIssue('type.mismatch', `Expected string, got ${typeof value}`);
      return;
    }

    if (value.length === 0) {
      ctx.addIssue('path.empty', 'Path cannot be empty.');
      return;
    }

    const spec = this.spec;
    const style = spec?.style ?? 'any';

    // Check absolute/relative
    const isUnixAbsolute = value.startsWith('/');
    const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(value);
    const isAbsolute = isUnixAbsolute || isWindowsAbsolute;

    if (spec?.absolute && !isAbsolute) {
      ctx.addIssue('path.not_absolute', `Path "${value}" must be absolute.`);
    }

    if (spec?.relative && isAbsolute) {
      ctx.addIssue('path.not_relative', `Path "${value}" must be relative.`);
    }

    // Check style
    if (style === 'unix' && isWindowsAbsolute) {
      ctx.addIssue('path.style_mismatch', `Path "${value}" should be Unix-style (no drive letter).`);
    }

    if (style === 'windows' && isUnixAbsolute && !isWindowsAbsolute) {
      ctx.addIssue('path.style_mismatch', `Path "${value}" should be Windows-style.`);
    }
  }

  describe(): TypeDescription {
    const constraints: string[] = [];
    if (this.spec?.style && this.spec.style !== 'any') {
      constraints.push(`style: ${this.spec.style}`);
    }
    if (this.spec?.absolute) {
      constraints.push('absolute');
    }
    if (this.spec?.relative) {
      constraints.push('relative');
    }
    return {
      name: 'Path',
      summary: 'Path',
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }
}

const defaultPath = new PathType(undefined);

/** Path type factory */
export const Path: {
  (spec?: PathSpec): PathType;
  _default: PathType;
} = Object.assign(
  (spec?: PathSpec) => spec ? new PathType(spec) : defaultPath,
  { _default: defaultPath }
);

// Convenience aliases
export const UnixPath = (spec?: Omit<PathSpec, 'style'>) =>
  new PathType({ style: 'unix', ...spec });

export const WindowsPath = (spec?: Omit<PathSpec, 'style'>) =>
  new PathType({ style: 'windows', ...spec });
