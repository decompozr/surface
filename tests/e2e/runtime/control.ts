/** Isolated integration-test control for low-level host operations, not a shipped CLI. */
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { main } from '../../../apps/cli/src/index.ts';

const args = process.argv.slice(2);
const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: false, options: {
  'state-dir': { type: 'string' }, namespace: { type: 'string' }, name: { type: 'string' }, project: { type: 'string' },
} });
const [command, argument] = positionals;
try {
  if (!['namespace', 'mount', 'unmount', 'list', 'health'].includes(command)) await main(args);
  else {
    if (typeof values['state-dir'] !== 'string') throw new Error('Specify isolated test state.');
    const connection = JSON.parse(readFileSync(join(values['state-dir'], 'connection.json'), 'utf8'));
    const origin = new URL(connection.origin);
    if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1') throw new Error('Expected a local test host.');
    const path = command === 'namespace' ? '/api/namespaces' : command === 'unmount' ? '/api/unmount' : command === 'health' ? '/api/health' : '/api/mounts';
    const data = command === 'namespace' ? { name: argument } : command === 'mount' ? {
      source: resolve(argument), namespace: values.namespace, name: values.name, projectRoot: values.project,
    } : command === 'unmount' ? { namespace: values.namespace, name: values.name } : undefined;
    const response = await fetch(new URL(path, origin), { method: data ? 'POST' : 'GET', headers: {
      authorization: `Bearer ${connection.token}`, 'content-type': 'application/json',
    }, body: data ? JSON.stringify(data) : undefined });
    const output = await response.json();
    if (!response.ok) throw new Error(output.error ?? String(response.status));
    console.log(JSON.stringify(output));
    if (output.status === 'failed') process.exitCode = 1;
  }
} catch (error) { console.error(error); process.exitCode = 1; }
