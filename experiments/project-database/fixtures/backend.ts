import { Database } from 'bun:sqlite';
import { mkdirSync, realpathSync, lstatSync } from 'node:fs';
import { join } from 'node:path';


const openStore = (directory: string) => {
  const databasePath = join(directory, 'scenarios.sqlite');
  mkdirSync(directory, { recursive: true });
  if (realpathSync(directory) !== directory) throw new Error('Project data directory must not be a symlink.');
  for (const path of [databasePath, databasePath + '-wal', databasePath + '-shm']) {
    try { if (lstatSync(path).isSymbolicLink()) throw new Error('Database files must not be symlinks.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const db = new Database(databasePath, { create: true, strict: true });
  try {
    db.exec('PRAGMA busy_timeout=0; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const version = (db.query('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version !== 0 && version !== 1) throw new Error('Unsupported project schema version.');
    db.transaction(() => {
      db.exec('CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, title TEXT NOT NULL, angle INTEGER NOT NULL CHECK (angle BETWEEN 0 AND 90), revision INTEGER NOT NULL CHECK (revision > 0))');
      db.exec('PRAGMA user_version=1');
    })();
    const list = db.query<Scenario, []>('SELECT id, title, angle, revision FROM scenarios ORDER BY id');
    const get = db.query<Scenario, [string]>('SELECT id, title, angle, revision FROM scenarios WHERE id=?');
    const put = db.query('INSERT INTO scenarios (id,title,angle,revision) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,angle=excluded.angle,revision=excluded.revision');
    const save = db.transaction((value: { id: string; title: string; angle: number; expectedRevision: number }, fail: boolean) => {
      const current = get.get(value.id);
      if ((current?.revision ?? 0) !== value.expectedRevision) return { ok: false as const, code: 'revision_conflict', message: 'Reload the current scenario before applying this change.' };
      put.run(value.id, value.title, value.angle, value.expectedRevision + 1);
      if (fail) throw new Error('fixture_rollback');
      return { ok: true as const, data: get.get(value.id)! };
    });
    return { db, list, save };
  } catch (error) { db.close(true); throw error; }
};


// Constructing the backend is inert. Only a validated database operation acquires a store.
export const createProjectBackend = (options?: { dataDirectory: string }) => {

  const acquire = () => {
    if (!store) { store = openStore(directory); opens++; }
    return store;
  };

  const directory = options?.dataDirectory ?? join(root, 'data');
  let store: ReturnType<typeof openStore> | undefined;
  let closed = false, opens = 0;
  return {
    inspect() { return { databaseOpen: store !== undefined, opens }; },
    invoke(action: string, input: unknown): Outcome {
      if (closed) return { ok: false, code: 'closed', message: 'Project backend is closed.' };
      if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, code: 'invalid_input', message: 'Expected an object.' };
      const value = input as Record<string, unknown>;
      // Non-persistent actions and rejected input must not create or open a database.
      if (action === 'describeProject' && Object.keys(value).length === 0) return { ok: true, data: { storage: 'optional' } };
      const listing = action === 'listScenarios';
      if (!listing && action !== 'saveScenario' && action !== 'failSaveForTest') return { ok: false, code: 'unknown_action', message: 'Unknown project operation.' };
      if (listing ? Object.keys(value).length !== 0 : Object.keys(value).sort().join(',') !== 'angle,expectedRevision,id,title' || typeof value.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(value.id) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120 || !Number.isInteger(value.angle) || (value.angle as number) < 0 || (value.angle as number) > 90 || !Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) return { ok: false, code: 'invalid_input', message: 'Use a valid operation payload; saving requires a title, an angle from 0 to 90, and the expected revision.' };
      try {
        const active = acquire();
        if (listing) return { ok: true, data: active.list.all() };
        return active.save.immediate(value as { id: string; title: string; angle: number; expectedRevision: number }, action === 'failSaveForTest');
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED') return { ok: false, code: 'database_busy', message: 'Another writer holds this project database. No change was applied.' };
        return { ok: false, code: store ? 'operation_failed' : 'database_unavailable', message: store ? 'Project operation failed and its transaction was rolled back.' : 'Project database could not be opened. No connection was retained.' };
      }
    },
    close() {
      if (!closed) { store?.db.close(true); store = undefined; closed = true; }
    },
  };
};


// Project-owned domain code. No Surface imports, manifest or state directory needed.
export type Scenario = { id: string; title: string; angle: number; revision: number };
export type Outcome = { ok: true; data: Scenario[] | Scenario | { storage: 'optional' } } | { ok: false; code: string; message: string };
const root = realpathSync(import.meta.dir);
export const databasePath = join(root, 'data', 'scenarios.sqlite');

// Independently executable by the project after Surface has stopped.
if (import.meta.main) {
  const db = new Database(databasePath, { readonly: true, strict: true });
  try { console.log(JSON.stringify({ rows: db.query('SELECT * FROM scenarios ORDER BY id').all(), integrity: db.query('PRAGMA integrity_check').get() })); }
  finally { db.close(true); }
}
