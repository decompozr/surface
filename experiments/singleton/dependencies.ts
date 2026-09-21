import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, sep, isAbsolute } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { InputError } from '../../src/core/service.ts';

const prefix = 'virtual:artifact-dependency/';
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);
function inside(root: string, path: string) { const part = relative(root, path); return part === '' || (part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part)); }
type Bundle = { source: string; code: string; entry: string; specifier: string; id: string };
type Source = { selected: Set<string>; bundles: Map<string, Bundle>; lock: string };

/** Bounded opt-in pilot: JS package entries only, rebuilt at mount preparation. */
export function scopedDependencies(isActive: (source: string) => boolean) {
  const sources = new Map<string, Source>();
  const bundles = new Map<string, Bundle>();
  let server: ViteDevServer;
  function check(id: string) {
    const record = bundles.get(id);
    if (!record || !isActive(record.source) || sources.get(record.source)?.bundles.get(record.specifier)?.id !== id) throw new InputError('Dependency bundle is not mounted.', 403);
    return record;
  }
  function release(source: string) {
    sources.delete(source);
    for (const [id, record] of bundles) if (record.source === source) {
      const module = server?.environments.client.moduleGraph.getModuleById(id);
      if (module) server.environments.client.moduleGraph.invalidateModule(module);
      bundles.delete(id);
    }
  }
  const plugin: Plugin = {
    name: 'surface-scoped-dependencies', enforce: 'pre',
    configureServer(value) { server = value; },
    async resolveId(id, importer) {
      if (id.startsWith('\0' + prefix)) { check(id); return id; }
      if (!importer || importer.startsWith('\0') || id.startsWith('.') || id.startsWith('/') || id.includes(':')) return;
      const source = [...sources.keys()].find(root => inside(root, importer.split('?')[0]!));
      if (!source || !isActive(source)) return;
      const state = sources.get(source)!;
      if (!state.selected.has(id)) return;
      const cached = state.bundles.get(id);
      if (cached) return cached.id;
      // Vite resolves browser export conditions; Bun then bundles that resolved entry.
      const resolved = await this.resolve(id, importer, { skipSelf: true });
      if (!resolved || resolved.external || !isAbsolute(resolved.id) || resolved.id.includes('?')) throw new InputError(`Cannot prebundle package entry ${id}.`);
      const entry = realpathSync(resolved.id);
      if (!inside(source, entry) || !entry.includes(sep + 'node_modules' + sep) || !/\.[cm]?[jt]sx?$/.test(entry)) throw new InputError(`Prebundle entry ${id} must resolve to a JavaScript package inside its source node_modules.`);
      const output = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm', splitting: false, sourcemap: 'none', external: ['svelte', 'svelte/*'], plugins: [{ name: 'reject-node-builtins', setup(build) { build.onResolve({ filter: /^[^./]/ }, args => { if (args.path.startsWith('node:') || builtins.has(args.path)) throw new Error(`Node builtin ${args.path} is outside this browser dependency pilot.`); return undefined; }); } }], define: { 'process.env.NODE_ENV': JSON.stringify('development') } }).catch(error => { const detail = error instanceof AggregateError ? error.errors.map(item => item?.message ?? String(item)).join('\n') : String(error); throw new InputError(`Prebundle failed for ${id}: ${detail}`); });
      if (!output.success) throw new InputError(`Prebundle failed for ${id}: ${output.logs.map(log => log.message).join('\n')}`);
      if (output.outputs.length !== 1 || output.outputs[0]!.kind !== 'entry-point' || !output.outputs[0]!.path.endsWith('.js')) throw new InputError(`Prebundle ${id} emitted assets or multiple outputs; this pilot accepts one JavaScript bundle only.`);
      const code = await output.outputs[0]!.text();
      const virtualId = '\0' + prefix + hash(source) + '/' + hash(entry + state.lock + code) + '.js';
      const record = { source, entry, specifier: id, code, id: virtualId };
      state.bundles.set(id, record); bundles.set(virtualId, record);
      return virtualId;
    },
    load(id) { if (id.startsWith('\0' + prefix)) return check(id).code; },
  };
  return {
    plugin, release,
    async prepare(source: string) {
      // Invalidate source-local aliases on remount, never another source's modules.
      release(source);
      const manifestPath = join(source, 'artifact.json');
      const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
      const selected = manifest.prebundle ?? [];
      if (!Array.isArray(selected) || selected.some(value => typeof value !== 'string' || value.startsWith('.') || value.split('/').some(segment => segment === '.' || segment === '..') || !/^(?:@[a-z\d._-]+\/)?[a-z\d._-]+(?:\/[a-z\d._-]+)*$/i.test(value) || value === 'svelte' || value.startsWith('svelte/'))) throw new InputError('prebundle must list package entry specifiers other than the shared Svelte runtime.');
      const lock = ['bun.lock', 'bun.lockb'].filter(name => existsSync(join(source, name))).map(name => readFileSync(join(source, name)).toString('base64')).join(':');
      sources.set(source, { selected: new Set(selected), bundles: new Map(), lock });
      try {
        for (const specifier of selected) {
          await server.environments.client.pluginContainer.resolveId(specifier, join(source, '__artifact_dependency_entry__.js'));
          if (!sources.get(source)?.bundles.has(specifier)) throw new InputError(`Selected package ${specifier} did not produce a scoped dependency bundle.`);
        }
      } catch (error) { release(source); throw error; }
    },
    checkRequest(pathname: string) {
      if (pathname.startsWith('/@id/__x00__' + prefix)) check('\0' + decodeURIComponent(pathname.slice('/@id/__x00__'.length)));
    },
  };
}
