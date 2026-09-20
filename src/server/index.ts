import { mkdirSync, openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AgentAdapter } from '../adapters/codex.ts';
import { CodexAdapter } from '../adapters/codex.ts';
import { Store } from '../core/store.ts';
import { Service, InputError } from '../core/service.ts';

function equal(left: string, right: string) {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function startServer(options: {
  stateDir: string; cliPath: string; uiDir: string; port?: number;
  uiOrigin?: string; adapter?: AgentAdapter;
}) {
  const stateDir = resolve(options.stateDir);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const lockPath = join(stateDir, 'server.lock');
  let lock: number;
  try { lock = openSync(lockPath, 'wx', 0o600); }
  catch { throw new Error(`Artifact state is already locked: ${lockPath}. Inspect the owning process before removing a stale lock.`); }
  writeFileSync(lock, String(process.pid));
  const token = randomBytes(32).toString('hex');
  let stopped = false;
  const release = () => {
    if (stopped) return;
    stopped = true;
    closeSync(lock);
    for (const path of [lockPath, join(stateDir, 'connection.json')]) {
      try { unlinkSync(path); } catch { /* already removed */ }
    }
  };
  try {
    const store = new Store(join(stateDir, 'state.json'));
    const service = new Service(store, options.adapter ?? new CodexAdapter(), options.cliPath, stateDir);
    const uiDir = resolve(options.uiDir);
    let origin = '';
    const json = (value: unknown, status = 200) => Response.json(value, {
      status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
    const server = Bun.serve({
      hostname: '127.0.0.1', port: options.port ?? 4317, maxRequestBodySize: 64 * 1024,
      async fetch(req) {
        try {
          const url = new URL(req.url);
          if (req.headers.get('host') !== new URL(origin).host) return json({ error: 'Invalid Host.' }, 403);
          const requestOrigin = req.headers.get('origin');
          if (requestOrigin && requestOrigin !== origin && requestOrigin !== options.uiOrigin) return json({ error: 'Invalid Origin.' }, 403);
          const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
          const admin = equal(bearer, token);
          const requireAdmin = () => { if (!admin) throw new InputError('Management authorization required.', 401); };
          const body = async () => {
            if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new InputError('Expected application/json.', 415);
            try { return await req.json(); } catch { throw new InputError('Invalid JSON body.'); }
          };
          if (url.pathname === '/api/health' && req.method === 'GET') return json({ service: 'artifact', status: 'ready' });
          if (url.pathname === '/api/bindings' && req.method === 'POST') {
            requireAdmin(); return json(await service.bind(await body()), 201);
          }
          if (url.pathname === '/api/requests' && req.method === 'POST') {
            requireAdmin();
            const record = service.create(await body());
            const previewOrigin = options.uiOrigin ?? origin;
            return json({ ...record, previewUrl: `${previewOrigin}/?request=${record.id}#token=${record.token}` }, 201);
          }
          if (url.pathname === '/api/requests' && req.method === 'GET') {
            requireAdmin(); return json(store.state.requests.map(record => service.view(record.id)));
          }
          const match = /^\/api\/requests\/([a-f0-9-]+)(?:\/(responses|result|close))?$/.exec(url.pathname);
          if (match) {
            const [, id, operation] = match;
            const record = service.get(id!);
            if (operation === 'result' || operation === 'close') requireAdmin();
            else if (!admin && !equal(bearer, record.token)) throw new InputError('Interaction authorization required.', 401);
            if (req.method === 'GET' && !operation) return json(service.view(id!));
            if (req.method === 'POST' && operation === 'responses') return json(await service.submit(id!, await body()));
            if (req.method === 'POST' && operation === 'result') return json(service.result(id!, await body()));
            if (req.method === 'POST' && operation === 'close') { service.close(id!); return json({ closed: true }); }
          }
          if (url.pathname.startsWith('/api/')) return json({ error: 'Unknown API operation.' }, 404);
          if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'Method not allowed.' }, 405);
          const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
          const path = resolve(uiDir, '.' + relative);
          if (!path.startsWith(uiDir + sep) || relative.split('/').some(part => part.startsWith('.'))) return json({ error: 'Not found.' }, 404);
          const file = Bun.file(path);
          if (!await file.exists()) return json({ error: 'Preview not built. Run bun run build:ui, or start with --dev.' }, 404);
          return new Response(file, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
        } catch (error) {
          const status = error instanceof InputError ? error.status : 500;
          if (status === 500) console.error(error);
          return json({ error: error instanceof InputError ? error.message : 'Operation failed. Inspect the local server log.' }, status);
        }
      },
    });
    origin = `http://127.0.0.1:${server.port}`;
    writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ origin, token, pid: process.pid }), { mode: 0o600 });
    return { server, service, origin, token, stop() { server.stop(true); release(); } };
  } catch (error) { release(); throw error; }
}
