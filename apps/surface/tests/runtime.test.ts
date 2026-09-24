import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/lib/server/services/store.ts';
import { Runtimes } from '../src/lib/server/services/runtime.ts';
import { startServer } from '../src/lib/server/http/index.ts';
import { scaffold } from '@decompozr/surface-cli/scaffold';
const cleanup: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'surface-runtime-')));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const store = new Store(join(root, 'state.json'));
  const runtimes = new Runtimes(store, 1500);
  cleanup.push(() => runtimes.shutdown());
  const directory = join(root, 'ui'); mkdirSync(directory);
  writeFileSync(join(directory, 'serve.ts'), `if(process.env.SURFACE_PORT!==process.env.ARTIFACT_PORT) throw new Error('Legacy port alias differs'); Bun.serve({hostname:'127.0.0.1',port:Number(process.env.SURFACE_PORT),fetch:()=>new Response('external preview')}); console.log('external ready');`);
  const record = runtimes.register({ projectRoot: root, directory, command: [process.execPath, 'serve.ts'] });
  return { root, directory, store, runtimes, record };
}
test('mounts once, reports logs, stops and restarts an external project from saved source', async () => {
  const { runtimes, record, store, root } = fixture();
  const [first, second] = await Promise.all([runtimes.mount(record.id), runtimes.mount(record.id)]);
  expect(first.status).toBe('ready'); expect(first.previewUrl).toBe(second.previewUrl);
  expect(await (await fetch(first.previewUrl!)).text()).toBe('external preview');
  expect(runtimes.logs(record.id).log).toContain('external ready');
  await runtimes.stop(record.id);
  await expect(fetch(first.previewUrl!)).rejects.toThrow();
  expect((await runtimes.mount(record.id)).status).toBe('ready');
  await runtimes.shutdown();
  const reopened = new Runtimes(new Store(join(root, 'state.json')));
  cleanup.push(() => reopened.shutdown());
  expect(reopened.inspect(record.id).status).toBe('stopped');
  expect((await reopened.mount(record.id)).status).toBe('ready');
  expect(store.state.runtimes).toHaveLength(1);
});
test('rejects directory escape and symlink replacement, reports startup errors', async () => {
  const { runtimes, root, directory, record } = fixture();
  expect(() => runtimes.register({ projectRoot: directory, directory: root, command: ['bun'] })).toThrow('within');
  const bad = runtimes.register({ projectRoot: root, directory, command: ['surface-executable-that-does-not-exist'] });
  expect((await runtimes.mount(bad.id)).status).toBe('failed');
  expect(runtimes.logs(bad.id).log).toContain('surface-executable-that-does-not-exist');
  rmSync(directory, { recursive: true }); symlinkSync(tmpdir(), directory);
  expect((await runtimes.mount(record.id)).status).toBe('failed');
});
test('stopping a starting runtime cancels startup and cleans its process', async () => {
  const { runtimes, record } = fixture();
  const start = runtimes.mount(record.id);
  await runtimes.stop(record.id);
  await start;
  expect(runtimes.inspect(record.id).status).toBe('stopped');
});
test('project CORS is restricted to its own interaction and cannot manage the service', async () => {
  const { root, directory } = fixture();
  const app = startServer({ stateDir: join(root, 'server'), cliPath: '/cli', uiDir: directory, port: 0,
    adapter: { inspect: async () => ({ status: 'idle' }), deliver: async () => ({ mode: 'start', turnId: 'fixture' }) },
  });
  cleanup.push(() => app.stop());
  app.service.store.update(state => state.bindings.push({ id: 'binding', projectRoot: root, threadId: 'fixture', socketPath: '/fixture' }));
  const definition = app.runtimes.register({ projectRoot: root, directory, command: [process.execPath, 'serve.ts'] });
  const runtime = await app.runtimes.mount(definition.id);
  const manager = { authorization: `Bearer ${app.token}`, 'content-type': 'application/json' };
  const create = await fetch(`${app.origin}/api/requests`, { method: 'POST', headers: manager, body: JSON.stringify({ bindingId: 'binding', runtimeId: runtime.id, title: 'Custom', schema: { type: 'object' } }) });
  const request = await create.json() as { id: string; token: string; previewUrl: string };
  expect(create.status).toBe(201); expect(new URL(request.previewUrl).origin).toBe(runtime.previewUrl!);
  const headers = { origin: runtime.previewUrl!, authorization: `Bearer ${request.token}`, 'content-type': 'application/json' };
  const preflight = await fetch(`${app.origin}/api/requests/${request.id}/responses`, { method: 'OPTIONS', headers: { origin: runtime.previewUrl!, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type' } });
  expect(preflight.status).toBe(204);
  const sent = await fetch(`${app.origin}/api/requests/${request.id}/responses`, { method: 'POST', headers, body: JSON.stringify({ responseId: 'custom', data: { count: 23 } }) });
  expect(sent.status).toBe(200); expect(sent.headers.get('access-control-allow-origin')).toBe(runtime.previewUrl!);
  const denied = await fetch(`${app.origin}/api/runtimes`, { headers }); expect(denied.status).toBe(403);
  const other = app.service.create({ bindingId: 'binding', title: 'Bundled request' });
  const cross = await fetch(`${app.origin}/api/requests/${other.id}`, { headers: { ...headers, authorization: `Bearer ${other.token}` } }); expect(cross.status).toBe(403);
  app.service.store.update(state => state.bindings.push({ id: 'other-project', projectRoot: directory, threadId: 'other', socketPath: '/fixture' }));
  const mismatch = await fetch(`${app.origin}/api/requests`, { method: 'POST', headers: manager, body: JSON.stringify({ bindingId: 'other-project', runtimeId: runtime.id, title: 'Wrong project' }) }); expect(mismatch.status).toBe(400);
});
test('scaffolding preserves nonempty projects and copies a standalone browser client', () => {
  const { root } = fixture();
  const directory = join(root, 'new-page');
  expect(scaffold(process.cwd(), directory, 'svelte').installed).toBe(false);
  expect(() => scaffold(process.cwd(), directory, 'svelte')).toThrow('overwrite');
  expect(Bun.file(join(directory, 'src/interactions.ts')).size).toBeGreaterThan(100);
});

test('killing the manager closes its preview process group', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'surface-crash-')));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const bootstrap = join(root, 'manager.ts');
  writeFileSync(bootstrap, `import { startServer } from ${JSON.stringify(join(process.cwd(), 'apps/surface/src/lib/server/http/index.ts'))};
const app=startServer({stateDir:${JSON.stringify(join(root, 'state'))},cliPath:'/cli',uiDir:${JSON.stringify(root)},port:0});
console.log(JSON.stringify({origin:app.origin,token:app.token}));`);
  writeFileSync(join(root, 'serve.ts'), "Bun.serve({hostname:'127.0.0.1',port:Number(process.env.SURFACE_PORT),fetch:()=>new Response('owned')});");
  const manager = Bun.spawn([process.execPath, bootstrap], { stdout: 'pipe', stderr: 'pipe' });
  cleanup.push(async () => { manager.kill(); await manager.exited; });
  const reader = manager.stdout.getReader();
  let line = '';
  while (!line.includes('\n')) {
    const { value, done } = await reader.read(); if (done) throw new Error('Manager exited before startup.');
    line += new TextDecoder().decode(value);
  }
  const connection = JSON.parse(line.split('\n')[0]!);
  const headers = { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' };
  const registered = await fetch(`${connection.origin}/api/runtimes`, { method: 'POST', headers, body: JSON.stringify({ projectRoot: root, directory: root, command: [process.execPath, 'serve.ts'] }) });
  const { id } = await registered.json() as { id: string };
  const mounted = await fetch(`${connection.origin}/api/runtimes/${id}/mount`, { method: 'POST', headers, body: '{}' });
  const runtime = await mounted.json() as { previewUrl: string; status: string };
  expect(runtime.status).toBe('ready');
  manager.kill('SIGKILL'); await manager.exited;
  let stopped = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { await fetch(runtime.previewUrl, { signal: AbortSignal.timeout(200) }); }
    catch { stopped = true; break; }
    await Bun.sleep(100);
  }
  expect(stopped).toBe(true);
}, 10_000);

test('a concurrent remount waits for stop to finish before creating another process', async () => {
  const { runtimes, record } = fixture();
  const first = await runtimes.mount(record.id);
  const stopping = runtimes.stop(record.id);
  const remounting = runtimes.mount(record.id);
  await stopping;
  const next = await remounting;
  expect(next.status).toBe('ready');
  expect(await (await fetch(next.previewUrl!)).text()).toBe('external preview');
  if (first.previewUrl !== next.previewUrl) await expect(fetch(first.previewUrl!)).rejects.toThrow();
});
