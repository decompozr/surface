import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { scaffold } from '@decompozr/surface-app/server/templates/index';

test('local templates use the current interaction API and refuse overwrites', () => {
  const root = mkdtempSync('/tmp/surface-templates-');
  try {
    for (const framework of ['svelte']) {
      const directory = join(root, framework);
      expect(scaffold(directory).installed).toBe(false);
      expect(readFileSync(join(directory, 'src/interactions.ts'), 'utf8')).toContain('createInteractionClient');
      expect(() => scaffold(directory)).toThrow('overwrite');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
