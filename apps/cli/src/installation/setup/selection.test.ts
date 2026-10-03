import { test, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inventory, parseBundle } from '../bundle.ts';
import { parseSetupSelection, verifyCheckoutCompatibility } from './selection.ts';

test('checkout compatibility allows unrelated docs/setup edits, rejects changed skill references and runtime CLI', () => {
  const root = mkdtempSync('/tmp/surface-compatible-');
  try {
    for (const directory of ['skills/surface/references', 'apps/cli/src/installation/setup', 'docs']) mkdirSync(join(root, directory), {recursive: true});
    writeFileSync(join(root, 'skills/surface/SKILL.md'), 'skill');
    writeFileSync(join(root, 'skills/surface/references/pages.md'), 'pages');
    writeFileSync(join(root, 'apps/cli/src/index.ts'), 'runtime');
    writeFileSync(join(root, 'apps/cli/src/installation/setup/setup.ts'), 'tool');
    const bundle = parseBundle({format: 1, version: '0.1.0-test.1', commit: 'a'.repeat(40), platform: process.platform, arch: process.arch, bun: Bun.version, files: inventory(root)});
    writeFileSync(join(root, 'docs/history.md'), 'pending history');
    writeFileSync(join(root, 'apps/cli/src/installation/setup/setup.ts'), 'changed tooling');
    expect(() => verifyCheckoutCompatibility(root, bundle)).not.toThrow();
    writeFileSync(join(root, 'skills/surface/references/pages.md'), 'changed skill');
    expect(() => verifyCheckoutCompatibility(root, bundle)).toThrow('skills/surface');
    writeFileSync(join(root, 'skills/surface/references/pages.md'), 'pages');
    writeFileSync(join(root, 'apps/cli/src/index.ts'), 'changed runtime');
    expect(() => verifyCheckoutCompatibility(root, bundle)).toThrow('apps/cli/src');
  } finally {rmSync(root, {recursive: true, force: true});}
});

test('saved legacy setup remains configuration, invalid external release/access data rejects', () => {
  const saved = {version: 3, skillsDirectories: ['/tmp/provider'], access: {enabled: false}};
  expect(parseSetupSelection(saved).release).toBeUndefined();
  expect(() => parseSetupSelection({...saved, release: {sha256: 'bad'}})).toThrow('release');
  expect(() => parseSetupSelection({...saved, access: {enabled: true, port: '8463'}})).toThrow('port');
  expect(() => parseSetupSelection({...saved, skillsDirectories: [12]})).toThrow('format');
});
