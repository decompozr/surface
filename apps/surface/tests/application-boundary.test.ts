import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
const app = resolve(import.meta.dir, '..');
test('production local-import graph stays inside apps/surface', () => {
  const queue = ['src/cli/index.ts', 'server/host.ts', 'mcp/server.ts', 'comments/delivery.ts'].map(path => resolve(app, path));
  const visited = new Set<string>();
  while (queue.length) {
    const file = queue.pop()!; if (visited.has(file)) continue; visited.add(file);
    expect(relative(app, file).startsWith('..')).toBe(false);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"\n]+)\1/g)) {
      const target = resolve(dirname(file), match[2]!);
      const resolved = [target, target + '.ts', target + '.js', target + '.svelte'].find(path => existsSync(path));
      expect(resolved, `${file}: ${match[2]}`).toBeDefined();
      queue.push(resolved!);
    }
  }
  expect(visited.size).toBeGreaterThan(20);
});
