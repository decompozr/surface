import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { startSurface } from '@decompozr/surface-app/server/http/surface';
export { startSurface as startWorkspaceHost } from '@decompozr/surface-app/server/http/surface';
if (import.meta.main) {
  const { values } = parseArgs({ options: { 'state-dir': { type: 'string' }, 'data-root': { type: 'string' }, port: { type: 'string' } } });
  if (!values['state-dir'] || !values['data-root']) throw new Error('Specify --state-dir and --data-root.');
  const app = await startSurface({ stateDir: resolve(values['state-dir']), dataRoot: resolve(values['data-root']), port: Number(values.port ?? 0) });
  console.log(JSON.stringify({ origin: app.origin, pid: app.pid }));
  for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal, () => void app.stop().then(() => process.exit(0)));
}
