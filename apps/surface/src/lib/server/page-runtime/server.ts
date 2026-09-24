import { createServer as createHTTPServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, renameSync, realpathSync, existsSync, symlinkSync, unlinkSync, readdirSync, lstatSync, openSync, closeSync, readlinkSync } from 'node:fs';
import { join, resolve, relative, sep, basename, dirname } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer as createViteServer, type ViteDevServer, type Plugin } from 'vite';
import { scopedDependencies } from './dependencies.ts';
import type { NavigationNode, NavigationMount } from '../../contracts/navigation.ts';
import { InputError } from '../../contracts/errors.ts';
import type { RuntimeIntegration, InteractionPort } from './ports.ts';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Workspace linkers place dependencies outside this package's node_modules.
// Allow only the actual browser runtime packages, not the entire workspace store.
const packageRoot = (specifier: string, from = import.meta.dir) => {
  let directory = dirname(realpathSync(Bun.resolveSync(specifier, from)));
  while (!existsSync(join(directory, 'package.json'))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Missing package root for ${specifier}`);
    directory = parent;
  }
  return directory;
};

const slug = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) throw new InputError('Use a lowercase namespace/name containing letters, digits, or hyphens.');
  return value;
};

const inside = (root: string, path: string) => { const part = relative(root, path); return part === '' || (part !== '..' && !part.startsWith('..' + sep) && !part.startsWith(sep)); };

const escapeHTML = (text: string) => { return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'); };

const json = (res: ServerResponse, data: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };

const body = async (req: IncomingMessage) => {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new InputError('Expected JSON.', 415);
  let value = '';
  for await (const part of req) { value += part.toString(); if (value.length > 65536) throw new InputError('Body too large.', 413); }
  try { const data = JSON.parse(value); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data as Record<string, unknown>; }
  catch { throw new InputError('Expected a JSON object.'); }
};


/** Preserve ownership while retargeting state across installed compiler releases. */
const prepareDependencyLink = (workspace: string, target: string) => {
  target = realpathSync(target);
  const link = join(workspace, 'node_modules'), marker = join(workspace, 'dependency-link.json');
  let existing: string | undefined;
  try {
    if (!lstatSync(link).isSymbolicLink()) throw new Error('Workspace node_modules is not an owned symlink; refusing replacement.');
    existing = resolve(workspace, readlinkSync(link));
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  let ownership: { version: number; target: string; previousTarget?: string } | undefined;
  if (existsSync(marker)) {
    if (!lstatSync(marker).isFile() || lstatSync(marker).isSymbolicLink()) throw new Error('Invalid workspace dependency-link ownership record.');
    ownership = JSON.parse(readFileSync(marker, 'utf8'));
    if (ownership?.version !== 1 || typeof ownership.target !== 'string' || (ownership.previousTarget !== undefined && typeof ownership.previousTarget !== 'string')) throw new Error('Invalid workspace dependency-link ownership record.');
  }
  if (existing && existing !== target && (!ownership || ![ownership.target, ownership.previousTarget].includes(existing))) throw new Error('Cannot verify ownership of the existing workspace dependency link. Inspect legacy or replaced state before migration.');
  if (existing && ownership && ![ownership.target, ownership.previousTarget].includes(existing)) throw new Error('Workspace dependency link differs from its ownership record.');
  const save = (value: unknown) => { writeFileSync(marker + '.tmp', JSON.stringify(value), { mode: 0o600 }); renameSync(marker + '.tmp', marker); };
  // Record both sides before replacement so a crash before/after rename is recoverable.
  save({ version: 1, target, previousTarget: existing });
  if (existing !== target) {
    const temporary = link + '.' + crypto.randomUUID() + '.tmp';
    try { symlinkSync(target, temporary, 'dir'); renameSync(temporary, link); }
    finally { try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
  }
  save({ version: 1, target });
};


/** Exploratory one-process, one-Vite component host. Separate from the previous runtime experiment. */
export const startPageRuntime = async (options: { integration: RuntimeIntegration; stateDir: string; port?: number; browserOrigin?: string; resolveMountPath?: (mount: MountResourceContext) => Promise<string | undefined>; navigation?: (mounts: NavigationMount[]) => NavigationNode[]; application?: (req: IncomingMessage, res: ServerResponse, navigation?: NavigationNode[]) => boolean | Promise<boolean>; openMountResource?: (mount: MountResourceContext) => Promise<MountResource> }) => {

  const closeResource = async (mount: Mount) => {
    const resource = mountResources.get(mount);
    if (resource) { await resource.close(); mountResources.delete(mount); }
  };

  const removeLink = (mount: Mount) => {
    const link = mountPath(mount);
    try { if (!lstatSync(link).isSymbolicLink()) throw new Error('Refusing to remove a non-symlink mount.'); unlinkSync(link); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  };

  const scan = (mount: Mount) => {

    const visit = (path: string) => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.isSymbolicLink()) continue;
        const child = join(path, entry.name);
        if (entry.isDirectory()) visit(child);
        else if (entry.name.endsWith('.svelte')) components.push(relative(mount.source, child).split(sep).join('/'));
      }
    };

    const manifestPath = join(mount.source, 'artifact.json');
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { framework: 'svelte', components: 'src' };
    if (manifest.framework !== 'svelte') throw new InputError('This experiment currently supports Svelte components only.');
    const directory = realpathSync(resolve(mount.source, manifest.components ?? 'src'));
    if (!inside(mount.source, directory)) throw new InputError('Component directory must be within the mounted source.');
    const components: string[] = [];
    visit(directory);
    mount.pages = {};
    if (manifest.routes !== undefined) {
      if (typeof manifest.routes !== 'string') throw new InputError('routes must name a source-relative directory.');
      const routeRoot = realpathSync(resolve(mount.source, manifest.routes));
      if (!inside(mount.source, routeRoot)) throw new InputError('Routes must be within the mounted source.');
      for (const component of components) {
        const path = relative(routeRoot, resolve(mount.source, component)).split(sep).join('/');
        if (path === '+page.svelte' || path.endsWith('/+page.svelte')) {
          const route = path === '+page.svelte' ? '' : path.slice(0, -'/+page.svelte'.length);
          if (route && !route.split('/').every(part => /^[a-z0-9][a-z0-9-]*$/.test(part))) throw new InputError('Only static lowercase page route segments are supported.');
          mount.pages[route] = component;
        }
      }
    }
    mount.components = components.sort(); mount.props = manifest.props ?? {};
    if (!mount.props || typeof mount.props !== 'object' || Array.isArray(mount.props)) throw new InputError('props must map component paths to JSON objects.');
    save();
  };

  const mutate = <T>(operation: () => Promise<T>): Promise<T> => {
    if (closing) return Promise.reject(new InputError('Server is closing.', 409));
    const task = pending.then(operation); pending = task.catch(() => {}); return task;
  };

  const namespace = (value: unknown) => {
    const name = slug(value);
    if (!registry.namespaces.includes(name)) registry.namespaces.push(name);
    save(); return { namespace: name };
  };

  const prepare = async (mount: Mount) => {
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
      if (options.resolveMountPath && existsSync(join(mount.projectRoot, 'artifact.project.json'))) {
        const publicPath = mount.publicPath ?? await options.resolveMountPath(mount);
        if (publicPath !== undefined) {
        if (!/^\/workspace\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(publicPath)) throw new InputError('Invalid readable mount path.');
        if (registry.mounts.some(other => other !== mount && other.publicPath === publicPath)) throw new InputError('Readable mount path already belongs to another mount.', 409);
        mount.publicPath = publicPath;
        }
      }
      scan(mount);
      const link = mountPath(mount); mkdirSync(join(workspace, 'mounts', mount.namespace), { recursive: true });
      if (existsSync(link) || (() => { try { lstatSync(link); return true; } catch { return false; } })()) removeLink(mount);
      symlinkSync(mount.source, link, 'dir');
      if (!vite.config.server.fs.allow.includes(mount.source)) vite.config.server.fs.allow.push(mount.source);
      vite.watcher.add([mount.source, ...(retiredWatchPaths.get(mount.source) ?? []).filter(path => existsSync(path))]);
      retiredWatchPaths.delete(mount.source);
      await dependencies.prepare(mount.source);
      // Compile discovered components through the SAME Vite instance. This is development transformation, not a production bundle.
      for (const component of mount.components) await vite.transformRequest(`/mounts/${mount.namespace}/${mount.name}/${component}`);
      if (options.openMountResource) {
        await closeResource(mount);
        mountResources.set(mount, await options.openMountResource({ namespace: mount.namespace, name: mount.name, source: mount.source, projectRoot: mount.projectRoot }));
      }
      phase(mount, 'ready');
      return view(mount);
    } catch (error) {
      phase(mount, 'failed', error instanceof Error ? error.message : String(error));
      await releaseMountResources(mount);
      return view(mount);
    }
  };

  const mount = async (input: Record<string, unknown>) => {
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
  };

  const invalidateMount = (record: Mount) => {
    for (const module of vite.environments.client.moduleGraph.idToModuleMap.values()) {
      if (module.id?.startsWith(record.source + '/') || module.id?.includes(`virtual:artifact-component/${record.namespace}/${record.name}/`)) vite.environments.client.moduleGraph.invalidateModule(module);
    }
  };

  const releaseMountResources = async (record: Mount) => {
    await closeResource(record);
    dependencies.release(record.source);
    // Chokidar unwatch(root) closes only that exact path. Explicitly close
    // descendants too; getWatched may retain empty directory metadata.
    const roots = [record.source, mountPath(record)];
    const paths = new Set(roots);
    for (const [directory, children] of Object.entries(vite.watcher.getWatched())) {
      if (!roots.some(root => inside(root, directory))) continue;
      paths.add(directory); for (const child of children) paths.add(join(directory, child));
    }
    const ordered = [...paths].sort((a, b) => b.length - a.length);
    await vite.watcher.unwatch(ordered);
    retiredWatchPaths.set(record.source, ordered);
    removeLink(record);
    vite.config.server.fs.allow = vite.config.server.fs.allow.filter(path => path !== record.source);
    invalidateMount(record);
  };

  const unmount = async (namespace: string, name: string) => {
    const record = find(namespace, name);
    // A retired definition may share its source with a later mount. It no
    // longer owns that source's watchers, allow entry, or dependency bundles.
    if (record.status === 'unmounted') return view(record);
    phase(record, 'unmounted');
    try { await releaseMountResources(record); }
    catch (error) {
      // Keep incomplete cleanup retryable instead of claiming it completed.
      phase(record, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
    vite.ws.send({ type: 'custom', event: 'artifact:unmounted', data: { namespace, name } });
    return view(record);
  };

  const parseVirtual = (id: string) => {
    const value = id.replace(/^\0/, '').slice(virtualPrefix.length);
    const [namespace, name, ...component] = value.split('/');
    const record = find(slug(namespace), slug(name));
    const path = decodeURIComponent(component.join('/').replace(/\.entry\.js$/, ''));
    if (!active(record) || !record.components.includes(path)) throw new InputError('Component is not mounted.', 404);
    return { record, path };
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (closing) throw new InputError('Server is closing.', 503);
    if (req.headers.host !== new URL(origin).host && (!browserURL || req.headers.host !== browserURL.host)) throw new InputError('Invalid Host.', 403);
    if (req.headers.origin && req.headers.origin !== origin && req.headers.origin !== browserURL?.origin) throw new InputError('Invalid Origin.', 403);
    const url = new URL(req.url!, browserURL && req.headers.host === browserURL.host ? browserURL.origin : origin);
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, { status: 'ready', experiment: 'singleton', pid: process.pid, instanceId, viteInstances: 1 });
      const received = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? ''), expected = Buffer.from(token);
      const admin = received.length === expected.length && timingSafeEqual(received, expected);
      if (await projectRoutes({ pathname: url.pathname, method: req.method, authorized: admin, readBody: () => body(req), json: (outcome, status) => json(res, outcome, status) })) return;
      if (await interactions.route(req, res, url, admin, () => body(req), (value, status) => json(res, value, status))) return;
      if (!admin) throw new InputError('Management authorization required.', 401);
      if (req.method === 'GET' && url.pathname === '/api/mounts') return json(res, registry.mounts.map(view));
      if (req.method === 'GET' && url.pathname === '/api/namespaces') return json(res, registry.namespaces);
      if (req.method === 'POST' && url.pathname === '/api/namespaces') {
        const input = await body(req);
        return json(res, await mutate(async () => namespace(input.name)), 201);
      }
      if (req.method === 'POST' && url.pathname === '/api/mounts') { const input = await body(req); return json(res, await mutate(() => mount(input))); }
      if (req.method === 'POST' && url.pathname === '/api/unmount') { const input = await body(req); return json(res, await mutate(() => unmount(slug(input.namespace), slug(input.name)))); }
      throw new InputError('Unknown operation.', 404);
    }
    const navigation = options.navigation?.(registry.mounts);
    if (await options.application?.(req, res, navigation)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new InputError('Method not allowed.', 405);
    const readable = registry.mounts.find(record => record.publicPath && (url.pathname === record.publicPath || url.pathname.startsWith(record.publicPath + '/')));
    const catalog = /^\/n\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(url.pathname);
    if (readable || catalog) {
      const record = readable ?? find(catalog![1]!, catalog![2]!);
      if (catalog && record.publicPath) throw new InputError('Use the mounted project page URL.', 404);
      if (record.status !== 'ready') throw new InputError('Mount is not ready.', 404);
      const route = readable ? url.pathname.slice(record.publicPath!.length).replace(/^\/|\/$/g, '') : undefined;
      const pageRouting = readable && Object.keys(record.pages ?? {}).length > 0;
      const component = pageRouting ? record.pages?.[route!] ?? null : url.searchParams.get('component');
      if (readable && route && !component && !Object.keys(record.pages ?? {}).some(page => page.startsWith(route + '/'))) throw new InputError('Unknown page.', 404);
      if (component && !record.components.includes(component)) throw new InputError('Unknown component.', 404);
      const requestId = url.searchParams.get('request');
      if (requestId) interactions.checkPage(requestId, record.namespace, record.name, component ?? '');
      const comments = requestId ? interactions.commentContext(requestId) : { recipient: '', label: 'Connect this page to an agent to send comments', live: true };
      const commentsEndpoint = requestId ? `/api/n/${record.namespace}/${record.name}/requests/${requestId}/comments` : '';
      const commentsStorageKey = JSON.stringify([record.namespace, record.name, component, requestId]);
      const revision = component ? createHash('sha256').update(readFileSync(join(record.source, component))).digest('hex') : '';
      const context = JSON.stringify({ comments, commentsEndpoint, commentsStorageKey, revision, navigation, publicPath: record.publicPath, interactionBase: `/api/n/${record.namespace}/${record.name}/requests/`, namespace: record.namespace, name: record.name, source: record.source, component, props: component ? record.props[component] ?? {} : {} }).replaceAll('<', '\\u003c');
      const client = `<script id="artifact-preview-context" type="application/json">${context}</script><script type="module" src="/@id/__x00__virtual:surface-preview"></script>`;
      const html = component
        ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(readable ? route || 'Home' : component)}</title></head><body>${client}<div id="surface-shell"></div><div id="surface-recipient"></div><div id="app"></div><script type="module" src="/@id/__x00__${virtualPrefix}${record.namespace}/${record.name}/${component.split('/').map(encodeURIComponent).join('/')}.entry.js"></script></body></html>`
        : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(route || basename(record.source))}</title></head><body>${client}<div id="surface-shell"></div><div id="app"><section class="surface-folder"><p>Pages in this folder</p><h1>${escapeHTML(route || basename(record.source))}</h1><ul data-artifact-catalog>${pageRouting ? Object.keys(record.pages ?? {}).filter(page => !route || page.startsWith(route + '/')).map(route => `<li><a href="${record.publicPath}/${route}">${escapeHTML(route || 'Home')}</a></li>`).join('') : record.components.map(path => `<li><a href="?component=${encodeURIComponent(path)}">${escapeHTML(path)}</a></li>`).join('')}</ul></section></div><script type="module" src="/@id/__x00__virtual:surface-shell"></script><script type="module" src="/@vite/client"></script></body></html>`;
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
  };

  const { allowedPaths, browserClient, shellSource, beforeComponent } = options.integration.presentation;
  const browserURL = options.browserOrigin ? new URL(options.browserOrigin) : undefined;
  if (browserURL && (browserURL.protocol !== 'https:' || browserURL.origin !== options.browserOrigin || browserURL.username || browserURL.password)) throw new Error('browserOrigin must be an exact HTTPS origin.');
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
  const mountResources = new Map<Mount, MountResource>();
  const mountPath = (mount: Mount) => join(workspace, 'mounts', mount.namespace, mount.name);
  const find = (namespace: string, name: string) => {
    const mount = registry.mounts.find(item => item.namespace === namespace && item.name === name);
    if (!mount) throw new InputError('Unknown mount.', 404);
    return mount;
  };
  let interactions: InteractionPort;
  const active = (mount: Mount) => mount.status === 'ready' || mount.status === 'preparing';
  const dependencies = scopedDependencies(source => registry.mounts.some(mount => mount.source === source && active(mount)));
  const view = (mount: Mount) => ({ ...mount, previewUrl: mount.status === 'ready' ? `${options.browserOrigin ?? origin}${mount.publicPath ?? `/n/${mount.namespace}/${mount.name}`}/` : undefined });
  const allowedFile = (path: string) => allowedPaths.some(root => inside(root, path)) || path === join(browserClient, 'index.ts') || inside(workspace, path) || browserFrameworkAssets.some(root => inside(root, path)) || registry.mounts.some(mount => active(mount) && inside(mount.source, path));
  // Serialize mutations so mounts cannot race installations, links, or Vite configuration.
  let pending: Promise<unknown> = Promise.resolve();
  // Project operations own the outer mutation queue. These runtime methods call
  // the same raw functions as the direct API, without recursively entering it.
  const projectRoutes = options.integration.projects({ stateDir, schedule: mutate, runtime: {
    namespace: async name => namespace(name),
    mount: input => mount(input),
    listMounts: async () => registry.mounts.map(view),
    unmount: input => unmount(slug(input.namespace), slug(input.name)),
  } });
  const installers = new Set<ReturnType<typeof Bun.spawn>>();
  const retiredWatchPaths = new Map<string, string[]>();
  const virtualPrefix = 'virtual:artifact-component/';
  const plugin: Plugin = {
    name: 'surface-singleton-components',
    resolveId(id) {
      // Resolve the public interaction module to one browser module identity.
      if (id === 'virtual:surface-interactions') return join(browserClient, 'index.ts');
      if (id === 'virtual:surface-shell') return '\0virtual:surface-shell';
      if (id === 'virtual:surface-preview') return '\0' + id;
      if (id.startsWith(virtualPrefix)) { parseVirtual(id); return '\0' + id; }
    },
    load(id) {
      if (id === '\0virtual:surface-shell') return shellSource;
      if (id === '\0virtual:surface-preview') return readFileSync(join(experimentRoot, 'preview-client.js'), 'utf8');
      if (!id.startsWith('\0' + virtualPrefix)) return;
      const { record, path } = parseVirtual(id);
      return `import 'virtual:surface-shell'; import { mount } from 'svelte'; ${beforeComponent} import { previewProps } from 'virtual:surface-preview'; import Component from ${JSON.stringify(`/mounts/${record.namespace}/${record.name}/${path}`)}; mount(Component, {target:document.getElementById('app'), props:previewProps()});`;
    },
  };
  const http = createHTTPServer((req, res) => { void handle(req, res).catch(error => { if (!res.headersSent) json(res, { error: error instanceof Error ? error.message : String(error) }, error instanceof InputError ? error.status : 500); else res.end(); }); });
  let rescanTimer: ReturnType<typeof setTimeout> | undefined;
  const rescans = new Set<Mount>();
  try {
    interactions = options.integration.interactions({ stateDir, find });
    // Shared framework runtime for this compiler experiment; project dependencies remain in their source folders.
    writeFileSync(join(workspace, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: compilerVersion } }));
    prepareDependencyLink(workspace, compilerAssets);
    vite = await createViteServer({
      configFile: false, root: workspace, appType: 'custom', publicDir: false,
      cacheDir: join(workspace, '.vite'),
      plugins: [dependencies.plugin, plugin, svelte({ configFile: false, prebundleSvelteLibraries: false })],
      resolve: { preserveSymlinks: false, dedupe: ['svelte'] },
      optimizeDeps: { noDiscovery: true, include: [], exclude: ['svelte'] },
      server: { allowedHosts: browserURL ? [browserURL.hostname] : [], middlewareMode: true, hmr: { server: http, overlay: false }, fs: { strict: true, allow: [workspace, ...allowedPaths, join(browserClient, 'index.ts'), ...browserFrameworkAssets] } },
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
              vite.ws.send({ type: 'custom', event: 'artifact:discovery', data: { namespace: record.namespace, name: record.name, components: record.components, pages: record.pages, publicPath: record.publicPath, changedProps, props: record.props } });
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
    return { origin, instanceId, pid: process.pid, vite, projectOperation: projectRoutes.execute, stop() {
      if (stopTask) return stopTask;
      closing = true;
      stopTask = (async () => {
        clearTimeout(rescanTimer);
        const interactionsStopped = interactions.stop();
        for (const child of installers) child.kill();
        await pending;
        await interactionsStopped;
        for (const mount of mountResources.keys()) await closeResource(mount);
        await vite.close();
        http.closeAllConnections(); await new Promise<void>(done => http.close(() => done()));
        closeSync(lock); unlinkSync(lockPath); unlinkSync(join(stateDir, 'connection.json'));
      })();
      return stopTask;
    } };
  } catch (error) {
    for (const mount of mountResources.keys()) await closeResource(mount);
    await vite!?.close(); http.close(); closeSync(lock);
    try { unlinkSync(lockPath); } catch { /* absent */ }
    throw error;
  }
};


const compilerVersion = '5.57.1';
const experimentRoot = import.meta.dir;
const compilerAssets = realpathSync(resolve(import.meta.dir, '../../../../node_modules'));
const svelteRoot = packageRoot('svelte');
const browserFrameworkAssets = [svelteRoot, packageRoot('esm-env', svelteRoot), packageRoot('clsx', svelteRoot), join(packageRoot('vite'), 'dist/client')];

type Phase = 'registered' | 'installing' | 'preparing' | 'ready' | 'failed' | 'unmounted';
type Mount = {
  namespace: string; name: string; source: string; projectRoot: string; status: Phase; components: string[];
  publicPath?: string; pages?: Record<string, string>;
  props: Record<string, Record<string, unknown>>; error?: string; log: string;
  history: { status: Phase; at: string }[];
};
type Registry = { namespaces: string[]; mounts: Mount[] };
/** Optional experiment seam, not a public backend/plugin contract. */
export type MountResource = { close(): void | Promise<void> };
export type MountResourceContext = Pick<Mount, 'namespace' | 'name' | 'source' | 'projectRoot'>;
