import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startSingleton } from '@decompozr/surface-app/server/host/runtime';
import type { createProjectBackend } from './fixtures/backend.ts';

const reply = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };

const equal = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

const body = async (req: IncomingMessage) => {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('Expected JSON.');
  let text = '';
  for await (const part of req) { text += part.toString(); if (text.length > 8192) throw new Error('Payload too large.'); }
  return JSON.parse(text);
};

const stop = async () => {
  if (stopping) return; stopping = true;
  try { await app.stop(); if (entries.size) throw new Error('Project connections remain open.'); process.exit(0); }
  catch (error) { console.error(error); process.exit(1); }
};


type Backend = ReturnType<typeof createProjectBackend>;
type Config = { stateDir: string; projects: { root: string; namespace: string; name: string; backend?: boolean }[] };
type Entry = { backend: Backend; token: string };
const config: Config = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const entries = new Map<string, Entry>();
const projects = config.projects.map(project => ({ ...project, root: realpathSync(project.root) }));
const identity = (namespace: string, name: string) => `${namespace}/${name}`;
if (new Set(projects.map(p => p.root)).size !== projects.length || new Set(projects.map(p => identity(p.namespace, p.name))).size !== projects.length) throw new Error('One unique mount per canonical project is required.');
const app = await startSingleton({
  stateDir: config.stateDir, port: 0,
  async openMountResource(mount) {
    const project = projects.find(p => p.root === mount.projectRoot && identity(p.namespace, p.name) === identity(mount.namespace, mount.name));
    if (!project || mount.source !== realpathSync(join(project.root, 'ui'))) throw new Error('Project backend scope is not configured.');
    if (!project.backend) return { close() {} };
    const modulePath = join(project.root, 'backend.ts');
    if (realpathSync(modulePath) !== modulePath) throw new Error('Backend entry must not be a symlink.');
    const module = await import(pathToFileURL(modulePath).href) as { createProjectBackend: typeof createProjectBackend };
    const backend = module.createProjectBackend();
    const key = identity(mount.namespace, mount.name), entry = { backend, token: randomBytes(32).toString('hex') };
    if (entries.has(key)) { backend.close(); throw new Error('Backend scope already open.'); }
    entries.set(key, entry);
    return { close() { backend.close(); if (entries.get(key) === entry) entries.delete(key); } };
  },
  async application(req, res) {
    const path = new URL(req.url!, 'http://localhost').pathname;
    if (!path.startsWith('/project-db/')) return false;
    // Fixture-only management inspection. Capability is never put in public props or logs.
    if (path === '/project-db/access') {
      const connection = JSON.parse(readFileSync(join(config.stateDir, 'connection.json'), 'utf8')) as { token: string };
      if (req.method !== 'GET' || !equal(req.headers.authorization ?? '', `Bearer ${connection.token}`)) { reply(res, 401, { ok: false, code: 'unauthorized' }); return true; }
      reply(res, 200, [...entries].map(([scope, entry]) => ({ scope, token: entry.token, database: entry.backend.inspect() }))); return true;
    }
    const match = /^\/project-db\/([a-z0-9-]+)\/([a-z0-9-]+)\/actions$/.exec(path);
    const entry = match ? entries.get(identity(match[1]!, match[2]!)) : undefined;
    if (!entry) { reply(res, 404, { ok: false, code: 'not_mounted', message: 'Project backend is not mounted.' }); return true; }
    if (req.method !== 'POST') { reply(res, 405, { ok: false, code: 'method_not_allowed' }); return true; }
    const token = req.headers['x-project-capability'];
    if (typeof token !== 'string' || !equal(token, entry.token)) { reply(res, 403, { ok: false, code: 'invalid_capability' }); return true; }
    let value;
    try {
      value = await body(req);
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'input,operation' || typeof value.operation !== 'string') throw new Error('Expected operation and input.');
    } catch { reply(res, 400, { ok: false, code: 'invalid_request', message: 'Expected a bounded JSON operation envelope.' }); return true; }
    // Admission is checked again after body acquisition; unmount may have closed the resource.
    if (entries.get(identity(match![1]!, match![2]!)) !== entry) { reply(res, 409, { ok: false, code: 'resource_closed' }); return true; }
    const outcome = entry.backend.invoke(value.operation, value.input);
    reply(res, outcome.ok ? 200 : outcome.code === 'database_busy' || outcome.code === 'revision_conflict' ? 409 : outcome.code === 'operation_failed' || outcome.code === 'database_unavailable' ? 500 : 400, outcome);
    return true;
  },
});
let stopping = false;
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
console.log(JSON.stringify({ ready: true, origin: app.origin, pid: process.pid }));
