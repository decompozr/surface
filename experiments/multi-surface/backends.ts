import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MountResourceContext } from '../../apps/surface/runtime/server.ts';

type Outcome = { ok: true; data: unknown } | { ok: false; code: string; message?: string };
type Backend = { invoke(operation: string, input: unknown): Outcome; close(): void | Promise<void>; inspect?(): unknown };
type Declaration = { version: 1; api: 1; entry: string; operations: string[] };
const contained = (parent: string, child: string) => { const path = relative(parent, child); return path === '' || (!path.startsWith('..' + '/') && path !== '..' && !isAbsolute(path)); };
export function declaration(root: string, source: string): (Declaration & { modulePath: string }) | undefined {
  root = realpathSync(root); source = realpathSync(source);
  const path = join(root, 'surface.backend.json');
  if (!existsSync(path)) return undefined;
  if (realpathSync(path) !== path || !statSync(path).isFile() || statSync(path).size > 8192) throw new Error('Backend declaration must be a bounded regular project file.');
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (!value || Object.keys(value).sort().join(',') !== 'api,entry,operations,version' || value.version !== 1 || value.api !== 1 || typeof value.entry !== 'string' || !Array.isArray(value.operations) || !value.operations.length || value.operations.length > 64 || value.operations.some((op: unknown) => typeof op !== 'string' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(op)) || new Set(value.operations).size !== value.operations.length) throw new Error('Invalid backend declaration or unsupported API.');
  if (isAbsolute(value.entry) || value.entry.split(/[\\/]/).some((part: string) => part === '..')) throw new Error('Backend entry must be a contained relative path.');
  const lexical = resolve(root, value.entry), modulePath = realpathSync(lexical);
  if (!contained(root, modulePath) || modulePath !== lexical || !statSync(modulePath).isFile() || contained(source, modulePath) || contained(source, path)) throw new Error('Backend entry and declaration must stay outside browser source, without symlink indirection.');
  return { ...value, modulePath };
}
function reply(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
async function body(req: IncomingMessage) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('Expected JSON.');
  let size = 0, text = '';
  for await (const part of req) { size += part.length; if (size > 8192) throw new Error('Payload too large.'); text += part.toString(); }
  return JSON.parse(text);
}
export type WorkspaceContext = { projectId: string; workspaceId: string; dataDirectory: string };

// Experiment only: serialize ownership transitions; actions remain synchronous.
export function backendRuntime(stateDir: string, context: (mount: MountResourceContext) => Promise<WorkspaceContext>) {
  type Owner = { root: string; context: WorkspaceContext; signature: string; backend: Backend; members: Set<string>; closing: boolean };
  type Entry = { backend: Backend; token: string; operations: Set<string> };
  const entries = new Map<string, Entry>(), owners = new Map<string, Owner>(), scopes = new Set<string>();
  const loadedSources = new Map<string, string>();
  let tail: Promise<unknown> = Promise.resolve();
  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation); tail = result.catch(() => {}); return result;
  }
  return {
    async openMountResource(mount: MountResourceContext) {
      return exclusive(async () => {
        const root = realpathSync(mount.projectRoot), identity = Object.freeze({ ...await context(mount) });
        const ownerKey = JSON.stringify([identity.projectId, identity.workspaceId]);
        const key = `${mount.namespace}/${mount.name}`, config = declaration(root, mount.source);
        let owner = owners.get(ownerKey);
        if (!config) {
          if (owner) throw new Error('Backend declaration changed while workspace is mounted.');
          return { async close() {} };
        }
        if (scopes.has(key)) throw new Error('Backend scope already mounted or closing.');
        const source = readFileSync(config.modulePath, 'utf8');
        if (loadedSources.has(config.modulePath) && loadedSources.get(config.modulePath) !== source) throw new Error('Backend source changed; restart the experiment host before loading it.');
        const signature = JSON.stringify([config.modulePath, [...config.operations].sort(), source]);
        if (owner && (owner.closing || owner.root !== root || owner.context.dataDirectory !== identity.dataDirectory || owner.signature !== signature)) {
          throw new Error('Workspace backend is closing or changed; finish cleanup before remounting.');
        }
        if (!owner) {
          const module = await import(pathToFileURL(config.modulePath).href);
          loadedSources.set(config.modulePath, source);
          if (module.apiVersion !== 1 || typeof module.createProjectBackend !== 'function') throw new Error('Backend module must export API 1 and a factory.');
          const backend = module.createProjectBackend(identity);
          if (!backend || typeof backend.invoke !== 'function' || typeof backend.close !== 'function') {
            await backend?.close?.(); throw new Error('Invalid backend factory contract.');
          }
          owner = { root, context: identity, signature, backend, members: new Set(), closing: false };
          owners.set(ownerKey, owner);
        }
        const owned = owner, entry = { backend: owned.backend, token: randomBytes(32).toString('hex'), operations: new Set<string>(config.operations) };
        scopes.add(key); owned.members.add(key); entries.set(key, entry);
        let closed = false;
        return { close() {
          // Revoke only this mount immediately, including already-reading HTTP bodies.
          if (entries.get(key) === entry) entries.delete(key);
          return exclusive(async () => {
            if (closed) return;
            if (owned.members.size === 1) {
              owned.closing = true;
              // A failure retains ownership and this handle for explicit retry.
              await owned.backend.close(); owners.delete(ownerKey);
            }
            owned.members.delete(key); scopes.delete(key); closed = true;
          });
        } };
      });
    },
    async application(req: IncomingMessage, res: ServerResponse) {
      const path = new URL(req.url!, 'http://localhost').pathname;
      if (!path.startsWith('/project-db/')) return false;
      if (path === '/project-db/access') {
        const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
        if (req.method !== 'GET' || !equal(req.headers.authorization ?? '', `Bearer ${connection.token}`)) { reply(res, 401, { ok: false, code: 'unauthorized' }); return true; }
        reply(res, 200, [...entries].map(([scope, entry]) => ({ scope, token: entry.token, operations: [...entry.operations], database: entry.backend.inspect?.() }))); return true;
      }
      const match = /^\/project-db\/([a-z0-9-]+)\/([a-z0-9-]+)\/actions$/.exec(path), key = match ? `${match[1]}/${match[2]}` : '';
      const entry = entries.get(key);
      if (!entry) { reply(res, 404, { ok: false, code: 'not_mounted' }); return true; }
      if (req.method !== 'POST') { reply(res, 405, { ok: false, code: 'method_not_allowed' }); return true; }
      const token = req.headers['x-project-capability'];
      if (typeof token !== 'string' || !equal(token, entry.token)) { reply(res, 403, { ok: false, code: 'invalid_capability' }); return true; }
      let value;
      try { value = await body(req); if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'input,operation' || typeof value.operation !== 'string') throw new Error(); }
      catch { reply(res, 400, { ok: false, code: 'invalid_request' }); return true; }
      if (entries.get(key) !== entry) { reply(res, 409, { ok: false, code: 'resource_closed' }); return true; }
      if (!entry.operations.has(value.operation)) { reply(res, 400, { ok: false, code: 'undeclared_operation' }); return true; }
      try {
        const outcome = entry.backend.invoke(value.operation, value.input);
        if (!outcome || typeof outcome.ok !== 'boolean' || outcome instanceof Promise) throw new Error('Invalid synchronous backend outcome.');
        reply(res, outcome.ok ? 200 : ['database_busy', 'revision_conflict'].includes(outcome.code) ? 409 : ['operation_failed', 'database_unavailable'].includes(outcome.code) ? 500 : 400, outcome);
      } catch { reply(res, 500, { ok: false, code: 'backend_failed' }); }
      return true;
    },
  };
}
