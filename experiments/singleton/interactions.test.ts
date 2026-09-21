import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, realpathSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createInteractions } from './interactions.ts';
import { startSingleton } from './server.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function temporary() { return realpathSync(mkdtempSync(join(tmpdir(), 'artifact-regression-'))); }

test('shutdown keeps singleton lock until admitted binding inspection persists', async () => {
  const stateDir = temporary(), gate = deferred<{ status: string }>(), entered = deferred<void>();
  const socketPath = join(stateDir, 'fixture.sock');
  const socket = Bun.listen({ unix: socketPath, socket: { data() {} } });
  let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
  try {
    app = await startSingleton({ stateDir, port: 0, adapter: {
      async inspect() { entered.resolve(); return gate.promise; },
      async deliver() { throw new Error('Unexpected delivery.'); },
    } });
    const { token } = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
    const binding = fetch(app.origin + '/api/bindings', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ projectRoot: stateDir, socketPath, threadId: 'fixture-held-bind' }) });
    await entered.promise;
    let stopped = false;
    const stopping = app.stop().then(() => { stopped = true; });
    let secondStopped = false;
    const secondStopping = app.stop().then(() => { secondStopped = true; });
    await Bun.sleep(30);
    expect(stopped).toBe(false);
    expect(secondStopped).toBe(false);
    expect(existsSync(join(stateDir, 'server.lock'))).toBe(true);
    await expect(startSingleton({ stateDir, port: 0 })).rejects.toThrow('locked');
    gate.resolve({ status: 'idle' });
    expect((await binding).status).toBe(201);
    await Promise.all([stopping, secondStopping]);
    expect(secondStopped).toBe(true);
    expect(existsSync(join(stateDir, 'server.lock'))).toBe(false);
    const snapshot = readFileSync(join(stateDir, 'interactions.json'), 'utf8');
    expect(JSON.parse(snapshot).bindings.map((item: { threadId: string }) => item.threadId)).toEqual(['fixture-held-bind']);
    await Bun.sleep(30);
    expect(readFileSync(join(stateDir, 'interactions.json'), 'utf8')).toBe(snapshot);
  } finally { gate.resolve({ status: 'idle' }); await app?.stop(); socket.stop(true); rmSync(stateDir, { recursive: true, force: true }); }
});

test('request body completing after closure cannot create a request or start binding inspection', async () => {
  const stateDir = temporary(), body = deferred<Record<string, unknown>>();
  let inspected = 0;
  const app = createInteractions({ stateDir, find() { throw new Error('Closed operation must not resolve mount.'); }, adapter: {
    async inspect() { inspected++; return { status: 'idle' }; },
    async deliver() { throw new Error('Unexpected delivery.'); },
  } });
  const request = { method: 'POST', headers: {} } as IncomingMessage;
  const response = {} as ServerResponse;
  try {
    const creation = app.route(request, response, new URL('http://127.0.0.1/api/requests'), true, () => body.promise, () => { throw new Error('Unexpected request creation.'); });
    // Attach the rejection assertion before releasing the body promise.
    const rejected = creation.then(() => { throw new Error('Late request creation succeeded.'); }, error => error);
    await app.stop();
    const snapshot = readFileSync(join(stateDir, 'interactions.json'), 'utf8');
    body.resolve({}); expect(await rejected).toMatchObject({ status: 503 });
    await expect(app.route(request, response, new URL('http://127.0.0.1/api/bindings'), true, async () => ({}), () => {})).rejects.toMatchObject({ status: 503 });
    expect(inspected).toBe(0);
    expect(readFileSync(join(stateDir, 'interactions.json'), 'utf8')).toBe(snapshot);
  } finally { body.resolve({}); await app.stop(); rmSync(stateDir, { recursive: true, force: true }); }
});

test('singleton CLI forwards state-dir both before and after requests command', async () => {
  const stateDir = temporary();
  const paths: string[] = [];
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    expect(request.headers.get('authorization')).toBe('Bearer fixture-token');
    paths.push(new URL(request.url).pathname); return Response.json([]);
  } });
  writeFileSync(join(stateDir, 'connection.json'), JSON.stringify({ origin: server.url.origin, token: 'fixture-token' }));
  try {
    for (const args of [['requests', '--state-dir', stateDir], ['--state-dir', stateDir, 'requests']]) {
      const child = Bun.spawn([process.execPath, join(import.meta.dir, 'cli.ts'), ...args], { stdout: 'pipe', stderr: 'pipe' });
      const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      expect(error).toBe(''); expect(code).toBe(0); expect(JSON.parse(out)).toEqual([]);
    }
    expect(paths).toEqual(['/api/requests', '/api/requests']);
  } finally { server.stop(true); rmSync(stateDir, { recursive: true, force: true }); }
});
