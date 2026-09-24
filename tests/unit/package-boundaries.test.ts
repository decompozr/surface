import { test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
const root = resolve(import.meta.dir, '../..');
const workspaces: string[] = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces;
const packages = new Map(workspaces.map(path => { const manifest = JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8')); return [manifest.name, { path, manifest }]; }));
const files = (directory: string): string[] => { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : /\.(ts|js|svelte)$/.test(entry.name) ? [join(directory, entry.name)] : []); }
test('workspace source imports follow declared exports and never reach experiments or another package by path', () => {
  for (const [name, { path, manifest }] of packages) {
    for (const file of files(join(root, path, 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*\(|import\s+)(['"])([^'"\n]+)\1/g)) {
        const spec = match[2]!;
        if (spec.startsWith('.')) expect(relative(join(root, path), resolve(file, '..', spec)).startsWith('..'), `${file}: ${spec}`).toBe(false);
        expect(spec.includes('experiments/'), `${file}: ${spec}`).toBe(false);
        if (!spec.startsWith('@decompozr/surface-')) continue;
        const dependency = spec.split('/').slice(0, 2).join('/');
        expect(packages.has(dependency), spec).toBe(true);
        if (dependency !== name) expect(manifest.dependencies?.[dependency], `${name}: ${dependency}`).toBe('workspace:*');
        if (path !== 'apps/cli') expect(dependency, `${name} must own its implementation`).toBe(name);
      }
    }
  }
});
test('production workspace dependency graph is acyclic', () => {
  const done = new Set<string>();
  const visit = (name: string, stack: string[]) => {
    expect(stack.includes(name), stack.join(' -> ') + ' -> ' + name).toBe(false);
    if (done.has(name)) return;
    for (const dependency of Object.keys(packages.get(name)!.manifest.dependencies ?? {})) if (packages.has(dependency)) visit(dependency, [...stack, name]);
    done.add(name);
  }
  for (const name of packages.keys()) visit(name, []);
});
