import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { main as interactionCLI } from './index.ts';
import { startSingleton } from '@decompozr/surface-app/server/host/runtime';
const args = process.argv.slice(2);
const { values, positionals, tokens } = parseArgs({ args, tokens: true, allowPositionals: true, options: {
  project: { type: 'string' }, thread: { type: 'string' }, socket: { type: 'string' }, binding: { type: 'string' }, title: { type: 'string' }, component: { type: 'string' },
  'allow-recipient-selection': { type: 'boolean' }, 'schema-file': { type: 'string' }, request: { type: 'string' }, data: { type: 'string' }, 'response-id': { type: 'string' },
  'state-dir': { type: 'string' }, port: { type: 'string' }, namespace: { type: 'string' }, name: { type: 'string' }, help: { type: 'boolean' },
} });
const stateDir = resolve(values['state-dir'] ?? join(import.meta.dir, '../../.decompozr/surface/singleton'));
const [command, argument] = positionals;
try {
  if (values.help || !command) console.log(`Surface singleton experiment (one HTTP server / one Vite)
serve [--port 4318]
namespace NAME
mount /source/folder --namespace NAME --name NAME [--project /project/root]
unmount --namespace NAME --name NAME
list
health
bind --project /project/root --thread EXACT_ID --socket /path/control.sock
request --binding ID --namespace NAME --name NAME --component src/Panel.svelte --title TITLE [--schema-file FILE]
requests
inspect --request ID
send --request ID --response-id ID --data JSON
result --request ID --data JSON
close --request ID
All commands accept --state-dir PATH. Mount automatically runs bun install in the source folder.
Svelte 5.57.1 components only; experimental development compilation, not production builds.`);
  else if (command === 'serve') {
    const port = Number(values.port ?? 4318);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
    const server = await startSingleton({ stateDir, port });
    console.log(JSON.stringify({ status: 'ready', origin: server.origin, pid: server.pid, instanceId: server.instanceId }));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.stop().then(() => process.exit(0)); });
  } else if (['bind', 'requests', 'inspect', 'send', 'result', 'close'].includes(command!)) {
    const commandIndex = tokens.find(token => token.kind === 'positional')!.index;
    await interactionCLI([command === 'requests' ? 'list' : command!, ...args.filter((_, index) => index !== commandIndex), ...(values['state-dir'] ? [] : ['--state-dir', stateDir])]);
  } else {
    const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
    const base = new URL(connection.origin);
    if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1') throw new Error('Expected a local connection.');
    let path: string, data: unknown;
    switch (command) {
      case 'request': path = '/api/requests'; data = { recipientSelection: values['allow-recipient-selection'] === true, bindingId: values.binding, title: values.title, namespace: values.namespace, name: values.name, component: values.component, schema: values['schema-file'] ? JSON.parse(readFileSync(resolve(values['schema-file']), 'utf8')) : undefined }; break;
      case 'namespace': path = '/api/namespaces'; data = { name: argument }; break;
      case 'mount': if (!argument) throw new Error('Expected source directory.'); path = '/api/mounts'; data = { namespace: values.namespace, name: values.name, source: resolve(argument), projectRoot: values.project ? resolve(values.project) : undefined }; break;
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
