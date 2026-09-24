import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { validateRelease } from '../../src/installation/compatibility.ts';

test('current releases reject incompatible stored schemas', async () => {
  const root = mkdtempSync('/tmp/surface-install-layout-');
  try {
    const state = join(root, 'state'); mkdirSync(state);
    writeFileSync(join(state, 'workspaces.json'), JSON.stringify({ version: 1 }));
    for (const layout of ['apps/cli/src/installation']) {
      const release = join(root, layout.replaceAll('/', '-'));
      const directory = join(release, layout); mkdirSync(directory, { recursive: true });
      const descriptor = join(directory, 'compatibility.json');
      writeFileSync(descriptor, JSON.stringify({ version: 1, workspaceLedgerVersions: [1], interactionVersions: [1], registryVersion: 'singleton-v1' }));
      await validateRelease(release, state);
      writeFileSync(descriptor, JSON.stringify({ version: 1, workspaceLedgerVersions: [2], interactionVersions: [1], registryVersion: 'singleton-v1' }));
      await expect(validateRelease(release, state)).rejects.toThrow('schema 1');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
