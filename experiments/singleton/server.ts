import { createServer as createHTTPServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, renameSync, realpathSync, existsSync, symlinkSync, unlinkSync, readdirSync, lstatSync, openSync, closeSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createViteServer, type ViteDevServer, type Plugin } from 'vite';
import { scopedDependencies } from './dependencies.ts';
import { createInteractions } from './interactions.ts';
import { InputError } from '../../src/core/service.ts';
import type { AgentAdapter } from '../../src/adapters/codex.ts';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const compilerVersion = '5.57.1';
const experimentRoot = import.meta.dir;
type Phase = 'registered' | 'installing' | 'preparing' | 'ready' | 'failed' | 'unmounted';
type Mount = {
  namespace: string; name: string; source: string; projectRoot: string; status: Phase; components: string[];
  props: Record<string, Record<string, unknown>>; error?: string; log: string;
  history: { status: Phase; at: string }[];
};
type Registry = { namespaces: string[]; mounts: Mount[] };
function slug(value: unknown) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new InputError('Use a lowercase namespace/name containing letters, digits, or hyphens.');
  return value;
}
function inside(root: string, path: string) { const part = relative(root, path); return part === '' || (part !== '..' && !part.startsWith('..' + sep) && !part.startsWith(sep)); }
function escapeHTML(text: string) { return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'); }
function json(res: ServerResponse, data: unknown, status = 200) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); }
async function body(req: IncomingMessage) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new InputError('Expected JSON.', 415);
  let value = '';
  for await (const part of req) { value += part.toString(); if (value.length > 65536) throw new InputError('Body too large.', 413); }
  try { const data = JSON.parse(value); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data as Record<string, unknown>; }
  catch { throw new InputError('Expected a JSON object.'); }
}

/** Exploratory one-process, one-Vite component host. Separate from the previous runtime experiment. */
export async function startSingleton(options: { stateDir: string; port?: number; adapter?: AgentAdapter; application?: (req: IncomingMessage, res: ServerResponse) => boolean | Promise<boolean> }) {
  const stateDir = resolve(options.stateDir), workspace = join(stateDir, 'workspace');
  mkdirSync(workspace, { recursive: true, mode: 0o700 });
  const lockPath = join(stateDir, 'server.lock');
  let lock: number;
  try { lock = openSync(lockPath, 'wx', 0o600); } catch { throw new Error('Singleton state is locked. Inspect the owner before removing a stale lock.'); }
  writeFileSync(lock, String(process.pid));
  const registryPath = join(stateDir, 'registry.json');
  let registry: Registry;
  try {
    registry = existsSync(registryPath) ? JSON.parse(readFileSync(registryPath, 'utf8')) : { namespaces: [], mounts: [] };
    for (const mount of registry.mounts ?? []) mount.projectRoot ??= mount.source;
    if (!Array.isArray(registry.namespaces) || !Array.isArray(registry.mounts)) throw new Error('Invalid singleton registry.');
  } catch (error) { closeSync(lock); unlinkSync(lockPath); throw error; }
  const save = () => { writeFileSync(registryPath + '.tmp', JSON.stringify(registry, null, 2), { mode: 0o600 }); renameSync(registryPath + '.tmp', registryPath); };
  const phase = (mount: Mount, status: Phase, error?: string) => { mount.status = status; mount.error = error; mount.history.push({ status, at: new Date().toISOString() }); mount.history = mount.history.slice(-30); save(); };
  const token = randomBytes(32).toString('hex');
  let origin = '', vite: ViteDevServer, closing = false;
  let stopTask: Promise<void> | undefined;
  const instanceId = crypto.randomUUID();
  const mountPath = (mount: Mount) => join(workspace, 'mounts', mount.namespace, mount.name);
  const find = (namespace: string, name: string) => {
    const mount = registry.mounts.find(item => item.namespace === namespace && item.name === name);
    if (!mount) throw new InputError('Unknown mount.', 404);
    return mount;
  };
  let interactions: ReturnType<typeof createInteractions>;
  const active = (mount: Mount) => mount.status === 'ready' || mount.status === 'preparing';
  const dependencies = scopedDependencies(source => registry.mounts.some(mount => mount.source === source && active(mount)));
  const view = (mount: Mount) => ({ ...mount, previewUrl: mount.status === 'ready' ? `${origin}/n/${mount.namespace}/${mount.name}/` : undefined });
  const allowedFile = (path: string) => inside(workspace, path) || inside(join(experimentRoot, 'node_modules'), path) || registry.mounts.some(mount => active(mount) && inside(mount.source, path));
  function removeLink(mount: Mount) {
    const link = mountPath(mount);
    try { if (!lstatSync(link).isSymbolicLink()) throw new Error('Refusing to remove a non-symlink mount.'); unlinkSync(link); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  function scan(mount: Mount) {
    const manifestPath = join(mount.source, 'artifact.json');
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { framework: 'svelte', components: 'src' };
    if (manifest.framework !== 'svelte') throw new InputError('This experiment currently supports Svelte components only.');
    const directory = realpathSync(resolve(mount.source, manifest.components ?? 'src'));
    if (!inside(mount.source, directory)) throw new InputError('Component directory must be within the mounted source.');
    const components: string[] = [];
    function visit(path: string) {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.isSymbolicLink()) continue;
        const child = join(path, entry.name);
        if (entry.isDirectory()) visit(child);
        else if (entry.name.endsWith('.svelte')) components.push(relative(mount.source, child).split(sep).join('/'));
      }
    }
    visit(directory);
    mount.components = components.sort(); mount.props = manifest.props ?? {};
    if (!mount.props || typeof mount.props !== 'object' || Array.isArray(mount.props)) throw new InputError('props must map component paths to JSON objects.');
    save();
  }
  // Serialize mutations so mounts cannot race installations, links, or Vite configuration.
  let pending: Promise<unknown> = Promise.resolve();
  function mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (closing) return Promise.reject(new InputError('Server is closing.', 409));
    const task = pending.then(operation); pending = task.catch(() => {}); return task;
  }
  const installers = new Set<ReturnType<typeof Bun.spawn>>();
  async function prepare(mount: Mount) {
    mount.log = '';
    try {
      if (realpathSync(mount.source) !== mount.source) throw new InputError('Source path changed. Register the intended path again.');
      const pkg = JSON.parse(readFileSync(join(mount.source, 'package.json'), 'utf8'));
      if (pkg.dependencies?.svelte !== compilerVersion && pkg.devDependencies?.svelte !== compilerVersion) throw new InputError(`This shared compiler experiment requires svelte exactly ${compilerVersion} in the source package.json.`);
      if (['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].some(name => existsSync(join(mount.source, name)))) throw new InputError('This experiment only prepares Bun projects; refusing to replace another package manager lockfile.');
      phase(mount, 'installing');
      const locked = existsSync(join(mount.source, 'bun.lock')) || existsSync(join(mount.source, 'bun.lockb'));
      const child = Bun.spawn([process.execPath, 'install', '--ignore-scripts', ...(locked ? ['--frozen-lockfile'] : [])], { cwd: mount.source, stdout: 'pipe', stderr: 'pipe' });
      installers.add(child);
      const timer = setTimeout(() => child.kill(), 90_000);
      const collect = async (stream: ReadableStream<Uint8Array>) => { for await (const chunk of stream) mount.log = (mount.log + new TextDecoder().decode(chunk)).slice(-65536); };
      const [code] = await Promise.all([child.exited, collect(child.stdout), collect(child.stderr)]).finally(() => { clearTimeout(timer); installers.delete(child); });
      if (code !== 0) throw new Error(`Dependency installation failed (${code}). Inspect mount logs. Existing lockfiles are frozen.`);
      if (closing) throw new Error('Server is closing.');
      phase(mount, 'preparing');
      scan(mount);
      const link = mountPath(mount); mkdirSync(join(workspace, 'mounts', mount.namespace), { recursive: true });
      if (existsSync(link) || (() => { try { lstatSync(link); return true; } catch { return false; } })()) removeLink(mount);
      symlinkSync(mount.source, link, 'dir');
      if (!vite.config.server.fs.allow.includes(mount.source)) vite.config.server.fs.allow.push(mount.source);
      vite.watcher.add(mount.source);
      await dependencies.prepare(mount.source);
      // Compile discovered components through the SAME Vite instance. This is development transformation, not a production bundle.
      for (const component of mount.components) await vite.transformRequest(`/mounts/${mount.namespace}/${mount.name}/${component}`);
      phase(mount, 'ready');
      return view(mount);
    } catch (error) {
      dependencies.release(mount.source);
      removeLink(mount);
      phase(mount, 'failed', error instanceof Error ? error.message : String(error));
      return view(mount);
    }
  }
  async function mount(input: Record<string, unknown>) {
    const namespace = slug(input.namespace), name = slug(input.name);
    if (!registry.namespaces.includes(namespace)) throw new InputError('Create the namespace first.', 404);
    if (typeof input.source !== 'string') throw new InputError('Expected a source directory.');
    const source = realpathSync(input.source);
    if (input.projectRoot !== undefined && typeof input.projectRoot !== 'string') throw new InputError('Invalid project root.');
    const projectRoot = realpathSync((input.projectRoot as string | undefined) ?? source);
    if (!lstatSync(projectRoot).isDirectory() || !inside(projectRoot, source)) throw new InputError('Mounted source must be inside its canonical project root.');
    if (!lstatSync(source).isDirectory()) throw new InputError('Expected a source directory.');
    if (inside(source, stateDir) || inside(stateDir, source)) throw new InputError('Source and singleton state directories must be separate.');
    let record = registry.mounts.find(item => item.namespace === namespace && item.name === name);
    if (record && (record.source !== source || record.projectRoot !== projectRoot)) throw new InputError('A mount name cannot silently change its source or project root.', 409);
    if (registry.mounts.some(item => item !== record && item.status !== 'unmounted' && (inside(item.source, source) || inside(source, item.source)))) throw new InputError('Overlapping active source directories are not supported in this experiment.', 409);
    if (record?.status === 'ready') return view(record);
    if (!record) { record = { namespace, name, source, projectRoot, status: 'registered', components: [], props: {}, log: '', history: [] }; registry.mounts.push(record); }
    phase(record, 'registered');
    return prepare(record);
  }
  function invalidateMount(record: Mount) {
    for (const module of vite.environments.client.moduleGraph.idToModuleMap.values()) {
      if (module.id?.startsWith(record.source + '/') || module.id?.includes(`virtual:artifact-component/${record.namespace}/${record.name}/`)) vite.environments.client.moduleGraph.invalidateModule(module);
    }
  }
  async function unmount(namespace: string, name: string) {
    const record = find(namespace, name);
    removeLink(record);
    phase(record, 'unmounted');
    dependencies.release(record.source);
    await vite.watcher.unwatch(record.source);
    vite.config.server.fs.allow = vite.config.server.fs.allow.filter(path => path !== record.source);
    invalidateMount(record);
    vite.ws.send({ type: 'custom', event: 'artifact:unmounted', data: { namespace, name } });
    return view(record);
  }
  const virtualPrefix = 'virtual:artifact-component/';
  function parseVirtual(id: string) {
    const value = id.replace(/^\0/, '').slice(virtualPrefix.length);
    const [namespace, name, ...component] = value.split('/');
    const record = find(slug(namespace), slug(name));
    const path = component.join('/').replace(/\.entry\.js$/, '');
    if (!active(record) || !record.components.includes(path)) throw new InputError('Component is not mounted.', 404);
    return { record, path };
  }
  const plugin: Plugin = {
    name: 'artifact-singleton-components',
    resolveId(id) { if (id === 'virtual:artifact-client') return '\0' + id; if (id === 'virtual:artifact-preview') return '\0' + id; if (id.startsWith(virtualPrefix)) { parseVirtual(id); return '\0' + id; } },
    load(id) {
      if (id === '\0virtual:artifact-client') return new Bun.Transpiler({ loader: 'ts' }).transformSync(readFileSync(join(experimentRoot, '../../src/client/index.ts'), 'utf8'));
      if (id === '\0virtual:artifact-preview') return readFileSync(join(experimentRoot, 'preview-client.js'), 'utf8');
      if (!id.startsWith('\0' + virtualPrefix)) return;
      const { record, path } = parseVirtual(id);
      return `import { mount } from 'svelte'; import { previewProps } from 'virtual:artifact-preview'; import Component from ${JSON.stringify(`/mounts/${record.namespace}/${record.name}/${path}`)}; mount(Component, {target:document.getElementById('app'), props:previewProps()});`;
    },
  };
  const http = createHTTPServer((req, res) => { void handle(req, res).catch(error => { if (!res.headersSent) json(res, { error: error instanceof Error ? error.message : String(error) }, error instanceof InputError ? error.status : 500); else res.end(); }); });
  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (closing) throw new InputError('Server is closing.', 503);
    if (req.headers.host !== new URL(origin).host) throw new InputError('Invalid Host.', 403);
    if (req.headers.origin && req.headers.origin !== origin) throw new InputError('Invalid Origin.', 403);
    const url = new URL(req.url!, origin);
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, { status: 'ready', experiment: 'singleton', pid: process.pid, instanceId, viteInstances: 1 });
      const received = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? ''), expected = Buffer.from(token);
      const admin = received.length === expected.length && timingSafeEqual(received, expected);
      if (await interactions.route(req, res, url, admin, () => body(req), (value, status) => json(res, value, status))) return;
      if (!admin) throw new InputError('Management authorization required.', 401);
      if (req.method === 'GET' && url.pathname === '/api/mounts') return json(res, registry.mounts.map(view));
      if (req.method === 'GET' && url.pathname === '/api/namespaces') return json(res, registry.namespaces);
      if (req.method === 'POST' && url.pathname === '/api/namespaces') {
        const input = await body(req);
        return json(res, await mutate(async () => { const name = slug(input.name); if (!registry.namespaces.includes(name)) registry.namespaces.push(name); save(); return { namespace: name }; }), 201);
      }
      if (req.method === 'POST' && url.pathname === '/api/mounts') { const input = await body(req); return json(res, await mutate(() => mount(input))); }
      if (req.method === 'POST' && url.pathname === '/api/unmount') { const input = await body(req); return json(res, await mutate(() => unmount(slug(input.namespace), slug(input.name)))); }
      throw new InputError('Unknown operation.', 404);
    }
    if (await options.application?.(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new InputError('Method not allowed.', 405);
    const catalog = /^\/n\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (catalog) {
      const record = find(catalog[1]!, catalog[2]!);
      if (record.status !== 'ready') throw new InputError('Mount is not ready.', 404);
      const component = url.searchParams.get('component');
      if (component && !record.components.includes(component)) throw new InputError('Unknown component.', 404);
      const requestId = url.searchParams.get('request');
      if (requestId) interactions.checkPage(requestId, record.namespace, record.name, component ?? '');
      const context = JSON.stringify({ interactionBase: `/api/n/${record.namespace}/${record.name}/requests/`, namespace: record.namespace, name: record.name, source: record.source, component, props: component ? record.props[component] ?? {} : {} }).replaceAll('<', '\\u003c');
      const client = `<script id="artifact-preview-context" type="application/json">${context}</script><script type="module" src="/@id/__x00__virtual:artifact-preview"></script>`;
      const html = component
        ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(component)}</title></head><body>${client}<div id="app"></div><script type="module" src="/@id/__x00__${virtualPrefix}${record.namespace}/${record.name}/${component.split('/').map(encodeURIComponent).join('/')}.entry.js"></script></body></html>`
        : `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(record.namespace + '/' + record.name)}</title></head><body>${client}<h1>${escapeHTML(record.namespace + '/' + record.name)}</h1><ul data-artifact-catalog>${record.components.map(path => `<li><a href="?component=${encodeURIComponent(path)}">${escapeHTML(path)}</a></li>`).join('')}</ul><script type="module" src="/@vite/client"></script></body></html>`;
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      res.end(await vite.transformIndexHtml(url.pathname, html)); return;
    }
    // Revoke raw source access after unmount, including already transformed module URLs.
    let file: string | undefined;
    if (url.pathname.startsWith('/@fs/')) file = decodeURIComponent(url.pathname.slice('/@fs'.length));
    else if (url.pathname.startsWith('/mounts/')) file = join(workspace, decodeURIComponent(url.pathname));
    if (file) {
      try { file = realpathSync(file); } catch { throw new InputError('Source not found.', 404); }
      if (!allowedFile(file)) throw new InputError('Source is not mounted.', 403);
    }
    if (url.pathname.startsWith('/@id/__x00__' + virtualPrefix)) parseVirtual(decodeURIComponent(url.pathname.slice('/@id/__x00__'.length)));
    dependencies.checkRequest(url.pathname);
    vite.middlewares(req, res, () => json(res, { error: 'Not found.' }, 404));
  }
  let rescanTimer: ReturnType<typeof setTimeout> | undefined;
  const rescans = new Set<Mount>();
  try {
    interactions = createInteractions({ stateDir, adapter: options.adapter, find });
    // Shared framework runtime for this compiler experiment; project dependencies remain in their source folders.
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: compilerVersion } }));
    const modules = join(workspace, 'node_modules');
    if (!existsSync(modules)) symlinkSync(join(experimentRoot, 'node_modules'), modules, 'dir');
    vite = await createViteServer({
      configFile: false, root: workspace, appType: 'custom', publicDir: false,
      cacheDir: join(workspace, '.vite'),
      plugins: [dependencies.plugin, plugin, svelte({ configFile: false, prebundleSvelteLibraries: false })],
      resolve: { preserveSymlinks: false },
      optimizeDeps: { noDiscovery: true, include: [], exclude: ['svelte'] },
      server: { middlewareMode: true, hmr: { server: http, overlay: false }, fs: { strict: true, allow: [workspace, join(experimentRoot, 'node_modules')] } },
      logLevel: 'error',
    });
    vite.watcher.on('all', (event, file) => {
      if (closing || !(event === 'add' || event === 'unlink' || file.endsWith('/artifact.json'))) return;
      const affected = registry.mounts.filter(record => record.status === 'ready' && inside(record.source, file));
      if (!affected.length) return;
      for (const record of affected) rescans.add(record);
      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        void mutate(async () => {
          for (const record of rescans) {
            if (record.status !== 'ready') continue;
            try {
              const previous = record.props;
              scan(record);
              const changedProps = [...new Set([...Object.keys(previous), ...Object.keys(record.props)])].filter(key => JSON.stringify(previous[key]) !== JSON.stringify(record.props[key]));
              vite.ws.send({ type: 'custom', event: 'artifact:discovery', data: { namespace: record.namespace, name: record.name, components: record.components, changedProps, props: record.props } });
            } catch (error) { phase(record, 'failed', String(error)); }
          }
          rescans.clear();
        }).catch(() => {});
      }, 100);
    });
    await new Promise<void>((done, reject) => { http.once('error', reject); http.listen(options.port ?? 4318, '127.0.0.1', done); });
    origin = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
    writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ origin, token, pid: process.pid, instanceId }), { mode: 0o600 });
    // Restore intended mounts using this same Vite instance, not saved URLs or spawned dev servers.
    for (const record of registry.mounts.filter(record => record.status !== 'unmounted')) await prepare(record);
    return { origin, instanceId, pid: process.pid, vite, stop() {
      if (stopTask) return stopTask;
      closing = true;
      stopTask = (async () => {
        clearTimeout(rescanTimer);
        const interactionsStopped = interactions.stop();
        for (const child of installers) child.kill();
        await pending;
        await interactionsStopped;
        await vite.close();
        http.closeAllConnections(); await new Promise<void>(done => http.close(() => done()));
        closeSync(lock); unlinkSync(lockPath); unlinkSync(join(stateDir, 'connection.json'));
      })();
      return stopTask;
    } };
  } catch (error) {
    await vite!?.close(); http.close(); closeSync(lock);
    try { unlinkSync(lockPath); } catch { /* absent */ }
    throw error;
  }
}
