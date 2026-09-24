import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const requestId = 'b66e6e8a-0f51-4520-945e-39fb9615c3ec';
test('reply CLI publishes current acknowledgements and rejects redirects, legacy syntax and mismatched bindings', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'surface-reply-test-'));
  const received: unknown[] = [];
  let redirect = false;
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch: async request => {
      if (redirect) return new Response(null, { status: 302, headers: { location: '/redirect-target' } });
      expect(new URL(request.url).pathname).toBe('/reply');
      expect(request.headers.get('authorization')).toBe('Bearer fixture');
      const data = await request.json();
      received.push(data);
      return Response.json(data);
    },
  });
  const writeState = (threadId = 'fixture') => writeFileSync(join(directory, 'interactions.json'), JSON.stringify({
    bindings: [{ id: 'binding', threadId, projectRoot: directory }],
    requests: [{ id: requestId, bindingId: 'binding' }],
  }));
  const run = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, resolve(import.meta.dir, './reply.ts'), ...args], { stdout: 'pipe', stderr: 'pipe' });
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    return { code, stdout, stderr };
  };
  try {
    writeFileSync(join(directory, 'connection.json'), JSON.stringify({
      origin: server.url.origin, resultPath: '/reply', callbackToken: 'fixture', threadId: 'fixture', projectRoot: directory,
    }));
    writeState();
    const acknowledgement = await run(requestId, 'Working', '--ack', '--state-dir', directory);
    expect(acknowledgement.code).toBe(0);
    expect(received).toEqual([{ requestId, result: { message: 'Working', stage: 'acknowledged' } }]);
    expect((await run(requestId, 'Done', '--state-dir', directory)).code).toBe(0);
    expect(received).toHaveLength(2);
    expect((await run('result', '--request', requestId, '--data', '{}', '--state-dir', directory)).code).not.toBe(0);
    writeState('another-thread');
    expect((await run(requestId, 'Wrong recipient', '--state-dir', directory)).stderr).toContain('different conversation');
    expect(received).toHaveLength(2);
    writeState();
    redirect = true;
    expect((await run(requestId, 'No redirect', '--state-dir', directory)).code).not.toBe(0);
    expect(received).toHaveLength(2);
  } finally {
    await server.stop(true);
    rmSync(directory, { recursive: true, force: true });
  }
});
