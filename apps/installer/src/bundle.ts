import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';

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

export const verifyBundle = (directory: string): Bundle => {
  const value=JSON.parse(readFileSync(join(directory,'surface-release.json'),'utf8')) as Bundle;
  if(value.format!==1||!/^\d+\.\d+\.\d+-[a-z0-9.-]+$/.test(value.version)||!/^[a-f0-9]{40}$/.test(value.commit))throw new Error('Invalid experimental release metadata.');
  if(value.platform!==process.platform||value.arch!==process.arch||value.bun!==Bun.version)throw new Error('Release platform, architecture, or Bun version does not match this installer.');
  if(JSON.stringify(inventory(directory))!==JSON.stringify(value.files))throw new Error('Release integrity check failed. Download and extract a fresh archive.');
  return value;
};


export type Bundle = { format: 1; version: string; commit: string; platform: string; arch: string; bun: string; files: Record<string,string> };
