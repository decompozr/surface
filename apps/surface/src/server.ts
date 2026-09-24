import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { startProjectApp } from './lib/server/host/project-app.ts';

try {
  const { values } = parseArgs({ options: {
    'state-dir': { type: 'string' }, 'browser-origin': { type: 'string' }, 'data-root': { type: 'string' }, port: { type: 'string' },
  } });
  if (!values['state-dir']) throw new Error('Use --state-dir PATH to select this development app\'s state explicitly.');
  const app = await startProjectApp({
    projectRoot: resolve(import.meta.dir, '../../..'),
    browserOrigin: values['browser-origin'], stateDir: values['state-dir'], dataRoot: values['data-root'], port: Number(values.port ?? process.env.PORT ?? 4319),
  });
  console.log(JSON.stringify({ service: 'surface', origin: app.origin, pid: app.pid, instanceId: app.instanceId, previewUrl: app.previewUrl }));
  const shutdown = () => {
    void app.stop().then(() => process.exit(0)).catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
