import { join, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { startSingleton } from '../../apps/surface/runtime/server';

const root = resolve(process.argv[2]!);
if (JSON.parse(readFileSync(join(root, 'fixture.json'), 'utf8')).kind !== 'surface-interrupted-delivery') {
  throw new Error('Expected an owned disposable fixture');
}
const host = await startSingleton({ stateDir: join(root, 'state'), port: 0 });
// connection.json is written before restore finishes; signal only after all
// intended mounts have completed the host's normal preparation path.
writeFileSync(join(root, 'ready.json'), JSON.stringify({ pid: process.pid }));
console.log(JSON.stringify({ ready: true, pid: process.pid, origin: host.origin }));
process.once('SIGTERM', () => { void host.stop().then(() => process.exit(0)); });
