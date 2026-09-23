import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexRpc } from '../src/adapters/rpc.ts';

test('initializes over Unix WebSocket without compression and correlates responses', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'surface-rpc-'));
  const socket = join(dir, 'control.sock');
  const methods: string[] = [];
  let compression: string | null = null;
  let clientInfo: unknown;
  const server = Bun.serve({ unix: socket,
    fetch(request, server) { compression = request.headers.get('sec-websocket-extensions'); if (server.upgrade(request)) return; return new Response('Upgrade required', { status: 426 }); },
    websocket: { message(ws, raw) {
      const message = JSON.parse(String(raw)); methods.push(message.method);
      if (message.method === 'initialize') clientInfo = message.params.clientInfo;
      if (message.id !== undefined) ws.send(JSON.stringify({ id: message.id, result: { echo: message.params } }));
    } },
  });
  let rpc: CodexRpc | undefined;
  try {
    rpc = await CodexRpc.connect(socket, 1000);
    expect(await rpc.call<{ echo: { value: number } }>('probe', { value: 42 })).toEqual({ echo: { value: 42 } });
    expect(methods).toEqual(['initialize', 'initialized', 'probe']);
    expect(compression).toBeNull();
    expect(clientInfo).toEqual({ name: 'surface', title: 'Surface', version: '0.1.0' });
  } finally { rpc?.close(); server.stop(true); rmSync(dir, { recursive: true, force: true }); }
});
