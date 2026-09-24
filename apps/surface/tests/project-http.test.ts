import { test, expect } from 'bun:test';
import { request as httpRequest } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startSingleton } from '../src/lib/server/host/runtime.ts';

const endpoint = '/api/v1/projects/operations';
function temporary() { return realpathSync(mkdtempSync(join(tmpdir(), 'surface-project-http-'))); }
function source(projectRoot: string, name = 'panel', version = '5.57.1') {
  const directory = join(projectRoot, name); mkdirSync(join(directory, 'src'), { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: version } }));
  writeFileSync(join(directory, 'src/Panel.svelte'), '<h1>Project HTTP fixture</h1>');
  return directory;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
async function start(stateDir: string) {
  const app = await startSingleton({ stateDir, port: 0 });
  const { token } = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  async function api(path: string, data?: unknown, authorized = true) {
    const response = await fetch(app.origin + path, {
      method: data === undefined ? 'GET' : 'POST', headers: { ...(authorized ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10_000),
    });
    return { status: response.status, data: await response.json() as any };
  }
  return { app, token, api, operation: (data: unknown) => api(endpoint, data) };
}

test('project HTTP authorizes before filesystem access and maps validation errors', async () => {
  const directory = temporary(), projectRoot = join(directory, 'project'); mkdirSync(projectRoot);
  let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
  try {
    const host = await start(join(directory, 'state')); app = host.app;
    const denied = await host.api(endpoint, { operation: 'init', projectRoot }, false);
    expect(denied.status).toBe(401); expect(denied.data).toMatchObject({ version: 1, ok: false, status: 'rejected', error: { code: 'unauthorized' } });
    expect(existsSync(join(projectRoot, 'artifact.project.json'))).toBe(false);
    const malformedUnauthorized = await fetch(app.origin + endpoint, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'not JSON' });
    expect(malformedUnauthorized.status).toBe(401);
    expect((await host.api(endpoint)).status).toBe(405);
    const malformed = await fetch(app.origin + endpoint, { method: 'POST', headers: { authorization: `Bearer ${host.token}`, 'content-type': 'application/json' }, body: '{' });
    expect(malformed.status).toBe(400); expect(await malformed.json()).toMatchObject({ version: 1, ok: false, status: 'rejected', error: { code: 'invalid_request' } });
    const wrongType = await fetch(app.origin + endpoint, { method: 'POST', headers: { authorization: `Bearer ${host.token}`, 'content-type': 'text/plain' }, body: '{}' });
    expect(wrongType.status).toBe(415);
    const invalid = await host.operation({ operation: 'init', projectRoot: 'relative/path' });
    expect(invalid.status).toBe(400); expect(invalid.data).toMatchObject({ version: 1, ok: false, status: 'rejected' });
    const initialized = await host.operation({ operation: 'init', projectRoot, name: 'HTTP project' });
    expect(initialized.status).toBe(200); expect(initialized.data).toMatchObject({ version: 1, ok: true, status: 'ok' });
    expect(existsSync(join(projectRoot, 'artifact.project.json'))).toBe(true);
    const extra = await host.operation({ operation: 'list', projectRoot, unexpected: true });
    expect(extra.status).toBe(400); expect(extra.data.status).toBe('rejected');
  } finally { await app?.stop(); rmSync(directory, { recursive: true, force: true }); }
});

test('project API and direct mounts share records and preserve sources through archive and failure', async () => {
  const directory = temporary(), projectRoot = join(directory, 'project'); mkdirSync(projectRoot);
  const panel = source(projectRoot), broken = source(projectRoot, 'broken', '0.0.0');
  const original = readFileSync(join(panel, 'src/Panel.svelte'), 'utf8');
  const neighbor = source(join(directory, 'neighbor'));
  let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
  try {
    const host = await start(join(directory, 'state')); app = host.app;
    await host.api('/api/namespaces', { name: 'neighbor' });
    const sibling = await host.api('/api/mounts', { namespace: 'neighbor', name: 'panel', source: neighbor });
    expect(sibling.data.status).toBe('ready');
    await host.operation({ operation: 'init', projectRoot, name: 'HTTP project' });
    const added = await host.operation({ operation: 'add', projectRoot, source: 'panel', name: 'Controls' });
    expect(added.status).toBe(200);
    const manifest = JSON.parse(readFileSync(join(projectRoot, 'artifact.project.json'), 'utf8'));
    const artifactId = manifest.artifacts[0].id;
    const mounted = await host.operation({ operation: 'mount', projectRoot, artifactId });
    expect(mounted.status).toBe(200); expect(mounted.data.ok).toBe(true);
    const records = (await host.api('/api/mounts')).data;
    const current = records.find((record: any) => record.source === panel);
    expect(current).toMatchObject({ projectRoot, status: 'ready' });
    expect((await fetch(`${current.previewUrl}?component=src%2FPanel.svelte`)).status).toBe(200);
    await host.api('/api/unmount', { namespace: current.namespace, name: current.name });
    const list = await host.operation({ operation: 'list', projectRoot });
    expect(list.data.data.artifacts[0].runtime.status).toBe('unmounted');
    expect((await host.operation({ operation: 'mount', projectRoot, artifactId })).status).toBe(200);
    expect((await host.operation({ operation: 'archive', projectRoot, artifactId })).status).toBe(200);
    expect(JSON.parse(readFileSync(join(projectRoot, 'artifact.project.json'), 'utf8')).artifacts[0].archived).toBe(true);
    expect((await fetch(current.previewUrl)).status).toBe(404);
    expect(readFileSync(join(panel, 'src/Panel.svelte'), 'utf8')).toBe(original);
    expect(existsSync(join(panel, 'node_modules'))).toBe(true);
    expect((await host.operation({ operation: 'restore', projectRoot, artifactId })).status).toBe(200);
    expect((await fetch(current.previewUrl)).status).toBe(404);
    await host.operation({ operation: 'add', projectRoot, source: 'broken', name: 'Failed preparation' });
    const brokenId = JSON.parse(readFileSync(join(projectRoot, 'artifact.project.json'), 'utf8')).artifacts.find((item: any) => item.source === 'broken').id;
    const failed = await host.operation({ operation: 'mount', projectRoot, artifactId: brokenId });
    expect(failed.status).toBe(500); expect(failed.data).toMatchObject({ version: 1, ok: false, status: 'failed' });
    expect(existsSync(join(broken, 'src/Panel.svelte'))).toBe(true);
    expect((await fetch(`${sibling.data.previewUrl}?component=src%2FPanel.svelte`)).status).toBe(200);
    expect((await host.api('/api/mounts')).data.find((record: any) => record.source === neighbor).status).toBe('ready');
  } finally { await app?.stop(); rmSync(directory, { recursive: true, force: true }); }
}, 30_000);

test('project operations share host mutation queue and shutdown excludes late request bodies', async () => {
  const directory = temporary(), projectRoot = join(directory, 'project'), lateRoot = join(directory, 'late');
  mkdirSync(projectRoot); mkdirSync(lateRoot); source(projectRoot);
  const gate = deferred<void>(), entered = deferred<void>();
  let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
  let slow: ReturnType<typeof httpRequest> | undefined;
  try {
    const host = await start(join(directory, 'state')); app = host.app;
    await host.operation({ operation: 'init', projectRoot, name: 'Queued project' });
    await host.operation({ operation: 'add', projectRoot, source: 'panel', name: 'Controls' });
    const artifactId = JSON.parse(readFileSync(join(projectRoot, 'artifact.project.json'), 'utf8')).artifacts[0].id;
    const transform = app.vite.transformRequest.bind(app.vite);
    app.vite.transformRequest = async (...args) => { if (args[0].startsWith('/mounts/p-')) { entered.resolve(); await gate.promise; } return transform(...args); };
    const mounting = host.operation({ operation: 'mount', projectRoot, artifactId });
    await entered.promise;
    let directComplete = false;
    const direct = host.api('/api/namespaces', { name: 'queued-direct' }).then(result => { directComplete = true; return result; });
    await Bun.sleep(30); expect(directComplete).toBe(false);
    const lateResponse = new Promise<{ status: number; data: any }>((done, reject) => {
      slow = httpRequest(app!.origin + endpoint, { method: 'POST', headers: { authorization: `Bearer ${host.token}`, 'content-type': 'application/json' } }, response => {
        let text = ''; response.on('data', chunk => { text += chunk.toString(); });
        response.on('end', () => done({ status: response.statusCode!, data: JSON.parse(text) }));
      });
      slow.once('error', reject); slow.write('{'); slow.flushHeaders();
    });
    // Allow the handler to enter body reading while the admitted mount owns the queue.
    await Bun.sleep(30);
    let stopped = false; const stopping = app.stop().then(() => { stopped = true; });
    await Bun.sleep(30);
    expect(stopped).toBe(false); expect(existsSync(join(directory, 'state/server.lock'))).toBe(true);
    slow!.end(JSON.stringify({ operation: 'init', projectRoot: lateRoot }).slice(1));
    const late = await lateResponse;
    expect(late.status).toBe(409); expect(late.data).toMatchObject({ version: 1, ok: false, status: 'rejected', error: { code: 'server_closing' } });
    expect(existsSync(join(lateRoot, 'artifact.project.json'))).toBe(false);
    gate.resolve();
    expect((await mounting).status).toBe(200); expect((await direct).status).toBe(201);
    await stopping; expect(existsSync(join(directory, 'state/server.lock'))).toBe(false);
    expect(JSON.parse(readFileSync(join(directory, 'state/registry.json'), 'utf8')).namespaces).toContain('queued-direct');
  } finally { gate.resolve(); slow?.destroy(); await app?.stop(); rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
