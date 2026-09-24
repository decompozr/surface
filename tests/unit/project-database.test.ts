import { test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, mkdirSync, copyFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { createProjectBackend } from '../fixtures/project-database/backend.ts';

test('failed first acquisition closes SQLite and a later explicit operation can recover', async () => {

  const handles = async () => {
    const process = Bun.spawn(['/usr/sbin/lsof', '-nP', '-p', String(globalThis.process.pid), '-Fn'], { stdout: 'pipe', stderr: 'pipe' });
    const output = await new Response(process.stdout).text(); await process.exited;
    return output.split('\n').filter(line => line === 'n' + path || line.startsWith('n' + path + '-'));
  };

  const root = realpathSync(mkdtempSync(join(tmpdir(), 'surface-db-acquisition-')));
  const path = join(root, 'data/scenarios.sqlite');
  mkdirSync(join(root, 'data'));
  copyFileSync(join(import.meta.dir, '../fixtures/project-database/backend.ts'), join(root, 'backend.ts'));
  const seed = new Database(path);
  seed.exec('CREATE TABLE scenarios (wrong_column TEXT); PRAGMA user_version=1'); seed.close(true);
  const module = await import(pathToFileURL(join(root, 'backend.ts')).href) as { createProjectBackend: typeof createProjectBackend };
  const backend = module.createProjectBackend();
  try {
    expect(backend.inspect()).toEqual({ databaseOpen: false, opens: 0 });
    expect(backend.invoke('listScenarios', {})).toMatchObject({ ok: false, code: 'database_unavailable' });
    expect(backend.inspect()).toEqual({ databaseOpen: false, opens: 0 });
    expect(await handles()).toEqual([]);
    const repair = new Database(path);
    repair.exec('DROP TABLE scenarios'); repair.close(true);
    expect(backend.invoke('saveScenario', { id: 'recovered', title: 'Recovered', angle: 40, expectedRevision: 0 })).toMatchObject({ ok: true, data: { revision: 1 } });
    expect(backend.inspect()).toEqual({ databaseOpen: true, opens: 1 });
    backend.close();
    expect(await handles()).toEqual([]);
  } finally { backend.close(); rmSync(root, { recursive: true, force: true }); }
});
