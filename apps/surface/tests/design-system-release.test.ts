import { expect, test } from 'bun:test';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { designSystemIdentity, materializeDesignSystem } from '../src/installation/design-system';

test('release owns pinned package bytes while development stays linked; drift rejects before replacing dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'surface-ds-release-'));
  try {
    const source = join(root, 'provider'), repo = join(root, 'repo'), release = join(root, 'release');
    mkdirSync(join(source, 'dist'), { recursive: true });
    writeFileSync(join(source, 'package.json'), JSON.stringify({ name: '@decompozr/design-system', version: '0.0.0' }));
    writeFileSync(join(source, 'dist/index.js'), 'export const marker = "pinned";');
    for (const directory of [repo, release]) {
      mkdirSync(join(directory, 'apps/surface/node_modules/@decompozr'), { recursive: true });
      symlinkSync(source, join(directory, 'apps/surface/node_modules/@decompozr/design-system'));
    }
    writeFileSync(join(release, 'apps/surface/design-system.lock.json'), JSON.stringify(designSystemIdentity(source)));
    materializeDesignSystem(repo, release);
    const installed = join(release, 'apps/surface/node_modules/@decompozr/design-system');
    expect(lstatSync(installed).isSymbolicLink()).toBe(false);
    expect(lstatSync(join(repo, 'apps/surface/node_modules/@decompozr/design-system')).isSymbolicLink()).toBe(true);
    writeFileSync(join(source, 'dist/index.js'), 'export const marker = "changed";');
    expect(readFileSync(join(installed, 'dist/index.js'), 'utf8')).toContain('pinned');
    expect(() => materializeDesignSystem(repo, release)).toThrow('differs from the committed pin');
    expect(readFileSync(join(installed, 'dist/index.js'), 'utf8')).toContain('pinned');
    expect(existsSync(join(release, '.surface-design-system.json'))).toBe(true);
    symlinkSync('/tmp', join(source, 'dist/foreign'));
    expect(() => designSystemIdentity(source)).toThrow('symlink');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
