import { mkdirSync, openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { AgentAdapter } from '../adapters/codex.ts';
import { CodexAdapter } from '../adapters/codex.ts';
import { Runtimes } from '../core/runtime.ts';
import { Store } from '../core/store.ts';
import { Service, InputError, object } from '../core/service.ts';

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
    const runtimes = new Runtimes(store);
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
          if (requestOrigin && requestOrigin !== origin && requestOrigin !== options.uiOrigin && !runtimes.isOrigin(requestOrigin)) return json({ error: 'Invalid Origin.' }, 403);
          const pageRequest = /^\/api\/requests\/([a-f0-9-]+)(?:\/(responses))?$/.exec(url.pathname);
          const cors = requestOrigin && runtimes.isOrigin(requestOrigin);
          if (cors && !pageRequest) return json({ error: 'Project origins can only access their interactions.' }, 403);
          if (cors && pageRequest) {
            const record = service.get(pageRequest[1]!);
            if (!record.runtimeId || runtimes.inspect(record.runtimeId).previewUrl !== requestOrigin) return json({ error: 'This interaction belongs to another preview origin.' }, 403);
          }
          const reply = (value: unknown, status = 200) => {
            const response = json(value, status);
            if (cors) {
              response.headers.set('Access-Control-Allow-Origin', requestOrigin!);
              response.headers.set('Vary', 'Origin');
            }
            return response;
          };
          if (req.method === 'OPTIONS' && cors) return new Response(null, { status: 204, headers: {
            'Access-Control-Allow-Origin': requestOrigin!, 'Access-Control-Allow-Methods': 'GET, POST',
            'Access-Control-Allow-Headers': 'authorization, content-type', 'Vary': 'Origin',
          } });
          const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
          const admin = equal(bearer, token);
          const requireAdmin = () => { if (!admin) throw new InputError('Management authorization required.', 401); };
          const body = async () => {
            if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new InputError('Expected application/json.', 415);
            try { return await req.json(); } catch { throw new InputError('Invalid JSON body.'); }
          };
          if (url.pathname === '/api/health' && req.method === 'GET') return json({ service: 'artifact', status: 'ready' });
          if (url.pathname === '/api/runtimes') {
            requireAdmin();
            if (req.method === 'GET') return json(runtimes.list());
            if (req.method === 'POST') return json(runtimes.register(await body()), 201);
          }
          const runtimeRoute = /^\/api\/runtimes\/([a-f0-9-]+)(?:\/(mount|stop|logs))?$/.exec(url.pathname);
          if (runtimeRoute) {
            requireAdmin();
            const [, id, operation] = runtimeRoute;
            if (req.method === 'GET' && !operation) return json(runtimes.inspect(id!));
            if (req.method === 'GET' && operation === 'logs') return json(runtimes.logs(id!));
            if (req.method === 'POST' && operation === 'mount') return json(await runtimes.mount(id!));
            if (req.method === 'POST' && operation === 'stop') return json(await runtimes.stop(id!));
          }
          if (url.pathname === '/api/bindings' && req.method === 'POST') {
            requireAdmin(); return json(await service.bind(await body()), 201);
          }
          if (url.pathname === '/api/requests' && req.method === 'POST') {
            requireAdmin();
            const input = object(await body());
            let previewOrigin = options.uiOrigin ?? origin;
            let previewPath = '/';
            if (input.runtimeId !== undefined) {
              if (typeof input.runtimeId !== 'string') throw new InputError('Invalid runtime ID.');
              const runtime = runtimes.inspect(input.runtimeId);
              const binding = store.state.bindings.find(item => item.id === input.bindingId);
              if (!binding || binding.projectRoot !== runtime.projectRoot) throw new InputError('Runtime and agent binding must belong to the same project.');
              if (runtime.status !== 'ready' || !runtime.previewUrl) throw new InputError('Mount the runtime before creating an interaction.', 409);
              previewOrigin = runtime.previewUrl;
              if (input.previewPath !== undefined && typeof input.previewPath !== 'string') throw new InputError('Invalid preview path.');
              previewPath = (input.previewPath as string | undefined) ?? '/';
              if (typeof previewPath !== 'string' || !previewPath.startsWith('/') || previewPath.startsWith('//') || previewPath.includes('\\')) throw new InputError('Expected a project-relative preview path.');
            }
            const preview = new URL(previewPath, previewOrigin);
            if (preview.origin !== previewOrigin || preview.hash || preview.search) throw new InputError('Preview path cannot contain an origin, query, or fragment.');
            const record = service.create(input);
            preview.searchParams.set('request', record.id);
            const fragment = new URLSearchParams({ token: record.token });
            if (record.runtimeId) fragment.set('api', origin);
            preview.hash = fragment.toString();
            return json({ ...record, previewUrl: preview.href }, 201);
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
            if (req.method === 'GET' && !operation) return reply(service.view(id!));
            if (req.method === 'POST' && operation === 'responses') return reply(await service.submit(id!, await body()));
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
          const response = json({ error: error instanceof InputError ? error.message : 'Operation failed. Inspect the local server log.' }, status);
          const requestOrigin = req.headers.get('origin');
          if (requestOrigin && runtimes.isOrigin(requestOrigin)) {
            response.headers.set('Access-Control-Allow-Origin', requestOrigin);
            response.headers.set('Vary', 'Origin');
          }
          return response;
        }
      },
    });
    origin = `http://127.0.0.1:${server.port}`;
    writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ origin, token, pid: process.pid }), { mode: 0o600 });
    return { server, service, runtimes, origin, token, async stop() { server.stop(true); await runtimes.shutdown(); release(); } };
  } catch (error) { release(); throw error; }
}
