import { parseArgs } from 'node:util';
import { startSurfaceApp } from './host.ts';

try {
  const { values } = parseArgs({ options: {
    'state-dir': { type: 'string' }, port: { type: 'string' },
  } });
  if (!values['state-dir']) throw new Error('Use --state-dir PATH to select this development app\'s state explicitly.');
  const app = await startSurfaceApp({
    stateDir: values['state-dir'], port: Number(values.port ?? process.env.PORT ?? 4319),
  });
  console.log(JSON.stringify({ service: 'surface', origin: app.origin, pid: app.pid, instanceId: app.instanceId }));
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
