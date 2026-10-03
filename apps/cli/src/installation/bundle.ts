import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { object, string, digest, commit } from './json.ts';

/** Hash bytes and link targets; reject links escaping the release and special files. */
export const inventory = (root: string): Record<string,string> => {

  const walk = (folder: string) => {
    for (const name of readdirSync(folder).sort()) {
      const path=join(folder,name), key=relative(root,path);
      if(key==='surface-release.json')continue;
      const stat=lstatSync(path);
      if(stat.isDirectory())walk(path);
      else if(stat.isSymbolicLink()) {
        const target=readlinkSync(path), resolved=relative(realpathSync(root),realpathSync(path));
        if(isAbsolute(target)||resolved==='..'||resolved.startsWith('..')||isAbsolute(resolved))throw new Error(`Release link escapes bundle: ${key}`);
        files[key]='link:'+target;
      } else if(stat.isFile())files[key]=createHash('sha256').update(readFileSync(path)).digest('hex');
      else throw new Error(`Unsupported release entry: ${key}`);
    }
  };

  const files: Record<string,string> = {};
  walk(root);return files;
};

export type Bundle = { format: 1; version: string; commit: string; platform: string; arch: string; bun: string; files: Record<string,string> };

export const parseBundle = (value: unknown): Bundle => {
  if (!object(value) || value.format !== 1 || !string(value.version) || !/^\d+\.\d+\.\d+-[a-z0-9.-]+$/.test(value.version) || !commit(value.commit)
    || !string(value.platform) || !string(value.arch) || !string(value.bun) || !object(value.files)) throw new Error('Invalid experimental release metadata.');
  const files: Record<string, string> = {};
  for (const [path, hash] of Object.entries(value.files)) {
    if (!path || path.startsWith('/') || path.split('/').some(part => part === '..' || part === '.' || !part) || !string(hash) || (!digest(hash) && !hash.startsWith('link:'))) throw new Error('Invalid release inventory.');
    files[path] = hash;
  }
  if (!Object.keys(files).length) throw new Error('Empty release inventory.');
  return {format: 1, version: value.version, commit: value.commit, platform: value.platform, arch: value.arch, bun: value.bun, files};
};

export const sameInventory = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value);
export const sameBundle = (a: Bundle, b: Bundle) => a.version === b.version && a.commit === b.commit && a.platform === b.platform && a.arch === b.arch && a.bun === b.bun && sameInventory(a.files, b.files);

export const verifyBundle = (directory: string, checkRuntime = true): Bundle => {
  const value = parseBundle(JSON.parse(readFileSync(join(directory, 'surface-release.json'), 'utf8')));
  if (value.platform !== process.platform || value.arch !== process.arch || (checkRuntime && value.bun !== Bun.version)) throw new Error('Release platform, architecture, or Bun version does not match this installer.');
  if (!sameInventory(inventory(directory), value.files)) throw new Error('Release integrity check failed. Download and extract a fresh archive.');
  return value;
};
