import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { startSingleton } from './server.ts';
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  'state-dir': { type: 'string' }, port: { type: 'string' }, namespace: { type: 'string' }, name: { type: 'string' }, help: { type: 'boolean' },
} });
const stateDir = resolve(values['state-dir'] ?? join(import.meta.dir, '../../.artifact/singleton'));
const [command, argument] = positionals;
try {
  if (values.help || !command) console.log(`Artifact singleton experiment (one HTTP server / one Vite)
serve [--port 4318]
namespace NAME
mount /source/folder --namespace NAME --name NAME
unmount --namespace NAME --name NAME
list
health
All commands accept --state-dir PATH. Mount automatically runs bun install in the source folder.
Svelte 5.57.1 components only; experimental development compilation, not production builds.`);
  else if (command === 'serve') {
    const port = Number(values.port ?? 4318);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
    const server = await startSingleton({ stateDir, port });
    console.log(JSON.stringify({ status: 'ready', origin: server.origin, pid: server.pid, instanceId: server.instanceId }));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.stop().then(() => process.exit(0)); });
  } else {
    const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
    const base = new URL(connection.origin);
    if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1') throw new Error('Expected a local connection.');
    let path: string, data: unknown;
    switch (command) {
      case 'namespace': path = '/api/namespaces'; data = { name: argument }; break;
      case 'mount': if (!argument) throw new Error('Expected source directory.'); path = '/api/mounts'; data = { namespace: values.namespace, name: values.name, source: resolve(argument) }; break;
      case 'unmount': path = '/api/unmount'; data = { namespace: values.namespace, name: values.name }; break;
      case 'list': path = '/api/mounts'; break;
      case 'health': path = '/api/health'; break;
      default: throw new Error('Unknown command. Use --help.');
    }
    const response = await fetch(new URL(path, base), { method: data === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(120_000) });
    const output = await response.json() as { error?: string; status?: string };
    if (!response.ok) throw new Error(output.error ?? String(response.status));
    console.log(JSON.stringify(output, null, 2));
    if (output.status === 'failed') process.exitCode = 1;
  }
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
