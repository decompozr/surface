import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server/index.ts';
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'surface-http-'));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  let deliveries = 0;
  const app = startServer({ stateDir: directory, cliPath: join(process.cwd(), 'apps/surface/src/cli/index.ts'), uiDir: join(process.cwd(), 'examples/svelte-feedback/dist'), port: 0,
    adapter: { inspect: async () => ({ status: 'idle' }), deliver: async () => { deliveries++; return { mode: 'start', turnId: 't' }; } },
  });
  cleanups.push(() => app.stop());
  app.service.store.update(state => { state.bindings.push({ id: 'binding', threadId: 't', projectRoot: realpathSync(directory), socketPath: '/test.sock' }); });
  const request = app.service.create({ bindingId: 'binding', title: 'Pick one' });
  return { app, request, directory, deliveries: () => deliveries };
}
test('a page token can submit only its own request and cannot manage sessions or publish results', async () => {
  const { app, request, deliveries } = fixture();
  const headers = { authorization: `Bearer ${request.token}`, 'content-type': 'application/json' };
  const response = await fetch(`${app.origin}/api/requests/${request.id}/responses`, {
    method: 'POST', headers, body: JSON.stringify({ responseId: 'id', data: { option: 'A', width: 120, comment: '' } }),
  });
  expect(response.status).toBe(200); expect(deliveries()).toBe(1);
  const list = await fetch(`${app.origin}/api/requests`, { headers }); expect(list.status).toBe(401);
  const result = await fetch(`${app.origin}/api/requests/${request.id}/result`, { method: 'POST', headers, body: '{}' }); expect(result.status).toBe(401);
  const other = app.service.create({ bindingId: 'binding', title: 'Other' });
  const read = await fetch(`${app.origin}/api/requests/${other.id}`, { headers }); expect(read.status).toBe(401);
});
test('rejects unexpected origins and hosts even with a valid token', async () => {
  const { app } = fixture();
  for (const extra of [{ origin: 'https://example.com' }, { host: 'example.com' }] as Record<string, string>[] ) {
    const response = await fetch(`${app.origin}/api/requests`, { headers: { authorization: `Bearer ${app.token}`, ...extra } });
    expect(response.status).toBe(403);
  }
});
test('CLI reads the same service state', async () => {
  const { directory, request } = fixture();
  const child = Bun.spawn([process.execPath, 'apps/surface/src/cli/index.ts', 'inspect', '--state-dir', directory, '--request', request.id], { stdout: 'pipe', stderr: 'pipe' });
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  expect(JSON.parse(output).title).toBe('Pick one');
});
test('a second server cannot open the same state directory', () => {
  const { directory } = fixture();
  expect(() => startServer({ stateDir: directory, cliPath: '/cli', uiDir: '/tmp', port: 0 })).toThrow('already locked');
});
