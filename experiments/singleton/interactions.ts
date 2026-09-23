import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { realpathSync as canonical } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { Service, InputError, text } from '../../src/core/service.ts';
import { Store, type PreviewScope } from '../../src/core/store.ts';
import { CodexAdapter, type AgentAdapter } from '../../src/adapters/codex.ts';

// Namespace paths scope capabilities and prevent accidental cross-mount routing.
// They do not isolate hostile scripts sharing this server's browser origin.
export type InteractionMount = { namespace: string; name: string; source: string; projectRoot: string; status: string; components: string[]; publicPath?: string; pages?: Record<string, string> };
export function createInteractions(options: {
  stateDir: string; adapter?: AgentAdapter;
  find(namespace: string, name: string): InteractionMount;
}) {
  let closing = false;
  const operations = new Set<Promise<unknown>>();
  function requireOpen() { if (closing) throw new InputError('Server is closing.', 503); }
  async function track<T>(operation: () => Promise<T>) {
    requireOpen();
    const task = operation(); operations.add(task);
    try { return await task; } finally { operations.delete(task); }
  }
  const store = new Store(join(options.stateDir, 'interactions.json'));
  const service = new Service(store, options.adapter ?? new CodexAdapter(), join(import.meta.dir, 'cli.ts'), options.stateDir);
  function mounted(scope: PreviewScope) {
    const mount = options.find(scope.namespace, scope.name);
    if (mount.status !== 'ready' || mount.source !== scope.source || mount.projectRoot !== scope.projectRoot || !mount.components.includes(scope.component)) {
      throw new InputError('Interaction preview is unavailable. Remount its original source/component to restore access.', 409);
    }
    if (canonical(mount.source) !== scope.source || canonical(mount.projectRoot) !== scope.projectRoot) throw new InputError('Interaction source identity changed.', 409);
    return mount;
  }
  function checkPage(id: string, namespace: string, name: string, component: string) {
    const scope = service.get(id).previewScope;
    if (!scope || scope.namespace !== namespace || scope.name !== name || scope.component !== component) throw new InputError('Interaction belongs to a different preview.', 403);
    mounted(scope);
  }
  function equal(left: string, right: string) {
    const a = Buffer.from(left), b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  async function route(req: IncomingMessage, res: ServerResponse, url: URL, admin: boolean,
    body: () => Promise<Record<string, unknown>>, json: (value: unknown, status?: number) => void): Promise<boolean> {
    const requireAdmin = () => { if (!admin) throw new InputError('Management authorization required.', 401); };
    if (url.pathname === '/api/bindings' && req.method === 'POST') {
      requireAdmin(); const data = await body();
      json(await track(() => service.bind(data)), 201); return true;
    }
    if (url.pathname === '/api/requests') {
      requireAdmin();
      if (req.method === 'GET') { json(store.state.requests.map(record => service.view(record.id))); return true; }
      if (req.method === 'POST') {
        const data = await body();
        requireOpen();
        if (data.runtimeId !== undefined || data.previewPath !== undefined) throw new InputError('Use namespace, name, and component for singleton interactions.');
        const mount = options.find(text(data.namespace, 'namespace'), text(data.name, 'mount name'));
        const binding = store.state.bindings.find(item => item.id === data.bindingId);
        if (!binding || binding.projectRoot !== mount.projectRoot) throw new InputError('Mount and agent binding must belong to the same canonical project.');
        const component = text(data.component, 'component');
        const scope: PreviewScope = { namespace: mount.namespace, name: mount.name, source: mount.source, projectRoot: mount.projectRoot, component };
        mounted(scope);
        const record = service.create(data, scope);
        const page = Object.entries(mount.pages ?? {}).find(([, file]) => file === component);
        const preview = new URL(mount.publicPath && page ? `${mount.publicPath}/${page[0]}` : `/n/${mount.namespace}/${mount.name}/`, url.origin);
        if (!mount.publicPath || !page) preview.searchParams.set('component', component);
        preview.searchParams.set('request', record.id);
        preview.hash = new URLSearchParams({ token: record.token }).toString();
        json({ ...record, previewUrl: preview.href }, 201); return true;
      }
    }
    const scoped = /^\/api\/n\/([a-z0-9-]+)\/([a-z0-9-]+)\/requests\/([a-f0-9-]+)(?:\/(responses|result|close|recipient))?$/.exec(url.pathname);
    const management = /^\/api\/requests\/([a-f0-9-]+)(?:\/(responses|result|close|recipient))?$/.exec(url.pathname);
    if (!scoped && !management) return false;
    const id = scoped?.[3] ?? management![1]!, operation = scoped?.[4] ?? management?.[2];
    // The unscoped routes are management-only, even when carrying a request token.
    if (!scoped || operation === 'result' || operation === 'close') requireAdmin();
    const record = service.get(id);
    if (scoped) {
      const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
      if (!admin && !equal(bearer, record.token)) throw new InputError('Interaction authorization required.', 401);
      const scope = record.previewScope;
      if (!scope || scope.namespace !== scoped[1] || scope.name !== scoped[2]) throw new InputError('Interaction belongs to a different mount.', 403);
      mounted(scope);
    }
    if (req.method === 'GET' && operation === 'recipient') json(await service.recipient(id));
    else if (req.method === 'GET' && !operation) json(service.view(id));
    else if (req.method === 'POST' && operation === 'responses') {
      if (!record.previewScope) throw new InputError('Missing preview identity.', 409);
      const data = await body();
      requireOpen();
      mounted(record.previewScope);
      json(await track(() => service.submit(id, data)));
    } else if (req.method === 'POST' && operation === 'result') { const data = await body(); requireOpen(); json(service.result(id, data)); }
    else if (req.method === 'POST' && operation === 'close') { requireOpen(); service.close(id); json({ closed: true }); }
    else throw new InputError('Method not allowed.', 405);
    return true;
  }
  return { route, checkPage, async stop() { closing = true; await Promise.allSettled([...operations]); } };
}
