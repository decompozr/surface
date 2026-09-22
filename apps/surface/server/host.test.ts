import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from './host.ts';

const temporary = () => realpathSync(mkdtempSync('/tmp/surface-app-host-'));
async function listeners() {
  const child = Bun.spawn(['/usr/sbin/lsof', '-nP', '-a', '-p', String(process.pid), '-iTCP', '-sTCP:LISTEN', '-Fn'], { stdout: 'pipe', stderr: 'pipe' });
  const output = await new Response(child.stdout).text(); const code = await child.exited;
  if (code !== 0 && code !== 1) throw new Error('Could not inspect process listeners.');
  return [...new Set(output.split('\n').filter(line => line.startsWith('n')).map(line => line.slice(1)))];
}

test('built SvelteKit and Vite share one instance and listener, then stop and restart cleanly', async () => {
  const stateDir = temporary();
  let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
  try {
    app = await startSurfaceApp({ stateDir, port: 0 });
    const health = await fetch(app.origin + '/health').then(r => r.json());
    const runtime = await fetch(app.origin + '/api/health').then(r => r.json());
    expect(health).toMatchObject({ service: 'surface', status: 'ready', runtime: { pid: app.pid, instanceId: app.instanceId, compiler: 'vite-development' } });
    expect(runtime).toMatchObject({ pid: app.pid, instanceId: app.instanceId, viteInstances: 1 });
    expect(app.vite.httpServer).toBeNull();
    expect(await listeners()).toEqual([new URL(app.origin).host]);
    const html = await fetch(app.origin).then(r => r.text());
    expect(html).toContain('A shared interactive environment for people and agents.');
    const compiler = await fetch(app.origin + '/@vite/client');
    expect(compiler.status).toBe(200); expect(await compiler.text()).toContain('WebSocket');
    expect((await fetch(app.origin + '/api/mounts')).status).toBe(401);
    expect((await fetch(app.origin + '/health', { method: 'POST' })).status).toBe(405);
    const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
    expect(html).not.toContain(connection.token); expect(JSON.stringify(health)).not.toContain(stateDir);
    const first = app.instanceId;
    await Promise.all([app.stop(), app.stop()]);
    expect(existsSync(join(stateDir, 'server.lock'))).toBe(false);
    expect(existsSync(join(stateDir, 'connection.json'))).toBe(false);
    expect(await listeners()).toEqual([]);
    await expect(fetch(app.origin + '/health')).rejects.toThrow();
    app = await startSurfaceApp({ stateDir, port: 0 });
    expect(app.instanceId).not.toBe(first);
    expect(await listeners()).toEqual([new URL(app.origin).host]);
  } finally { await app?.stop(); rmSync(stateDir, { recursive: true, force: true }); }
}, 30000);

test('state/port conflicts preserve the original host and release failed startup ownership', async () => {
  const stateDir = temporary(), other = temporary();
  const app = await startSurfaceApp({ stateDir, port: 0 });
  try {
    await expect(startSurfaceApp({ stateDir, port: 0 })).rejects.toThrow('locked');
    await expect(startSurfaceApp({ stateDir: other, port: Number(new URL(app.origin).port) })).rejects.toThrow();
    expect(existsSync(join(other, 'server.lock'))).toBe(false);
    expect((await fetch(app.origin + '/health').then(r => r.json())).runtime.instanceId).toBe(app.instanceId);
    expect(await listeners()).toEqual([new URL(app.origin).host]);
    await expect(startSurfaceApp({ stateDir: other, port: -1 })).rejects.toThrow('Invalid port');
  } finally { await app.stop(); rmSync(stateDir, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); }
}, 30000);

test('explicit HTTPS browser origin preserves host/origin and management guards', async () => {
  const stateDir = temporary();
  const browserOrigin = 'https://surface.example.test:8463';
  let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
  try {
    await expect(startSurfaceApp({ stateDir, port: 0, browserOrigin: 'http://surface.example.test' })).rejects.toThrow('HTTPS origin');
    expect(existsSync(join(stateDir, 'server.lock'))).toBe(false);
    app = await startSurfaceApp({ stateDir, port: 0, browserOrigin });
    const headers = { host: new URL(browserOrigin).host, origin: browserOrigin };
    expect((await fetch(app.origin + '/health', { headers })).status).toBe(200);
    expect((await fetch(app.origin + '/@vite/client', { headers })).status).toBe(200);
    expect((await fetch(app.origin + '/health', { headers: { host: 'other.example.test' } })).status).toBe(403);
    expect((await fetch(app.origin + '/health', { headers: { ...headers, origin: 'https://other.example.test' } })).status).toBe(403);
    expect((await fetch(app.origin + '/api/mounts', { headers })).status).toBe(401);
    expect(JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8')).origin).toBe(app.origin);
  } finally { await app?.stop(); rmSync(stateDir, { recursive: true, force: true }); }
}, 30000);
