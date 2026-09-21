import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
export function scaffold(root: string, directory: string, framework: string) {
  if (framework !== 'svelte' && framework !== 'vanilla') throw new Error('Framework must be svelte or vanilla.');
  const target = resolve(directory);
  if (existsSync(target) && readdirSync(target).length) throw new Error('Choose an empty directory; Surface will not overwrite project files.');
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(join(root, 'templates', framework))) {
    cpSync(join(root, 'templates', framework, entry), join(target, entry), { recursive: true, errorOnExist: true, force: false });
  }
  cpSync(join(root, 'src/client/index.ts'), join(target, 'src/surface-client.ts'), { errorOnExist: true, force: false });
  writeFileSync(join(target, '.gitignore'), 'node_modules/\ndist/\n.env\n.env.*\n');
  return { directory: target, framework, installed: false, next: 'Install dependencies explicitly in this directory, then register and mount it.' };
}
