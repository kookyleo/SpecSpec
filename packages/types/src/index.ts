// src/index.ts
// @specspec/types - Extended types for SpecSpec

// Object type with discriminator support
export { ObjectType, ObjectTypeClass, EXISTS, type ObjectSpec, type Discriminator } from './object.js';

// Extended string types
export { SemVer, SemVerType } from './strings.js';
export { Url, UrlType, type UrlSpec } from './strings.js';
export { Path, PathType, UnixPath, WindowsPath, type PathSpec } from './strings.js';

// Archive file types
export { ZipFile, ZipFileType, type ZipFileSpec } from './archive.js';
export { TarFile, TarFileType, type TarFileSpec } from './archive.js';
