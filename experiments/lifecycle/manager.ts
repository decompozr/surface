import { parseArgs } from 'node:util';
import { Installation, type Host } from '@decompozr/surface-installer/manager';
export { Installation, type Host } from '@decompozr/surface-installer/manager';

if (import.meta.main) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { home: { type: 'string' }, repo: { type: 'string' }, ref: { type: 'string' }, host: { type: 'string' }, port: { type: 'string' } } });
  try {
    const home = values.home ?? process.env.SURFACE_HOME ?? process.env.ARTIFACT_HOME;
    if (!home) throw new Error('Specify an isolated --home or SURFACE_HOME.');
    const installation = new Installation(home);
    let result: unknown;
    switch (positionals[0]) {
      case 'install': if (!values.repo || !values.ref) throw new Error('install requires --repo and --ref.'); result = await installation.install(values.repo, values.ref, (values.host ?? 'singleton') as Host); break;
      case 'activate': if (!positionals[1]) throw new Error('activate requires a release identity.'); result = await installation.activate(positionals[1]); break;
      case 'start': result = (await installation.start(values.port === undefined ? undefined : Number(values.port))).status; break;
      case 'health': result = await installation.health(); break;
      case 'stop': result = await installation.stop(); break;
      case 'restart': await installation.stop(); result = (await installation.start(values.port === undefined ? undefined : Number(values.port))).status; break;
      case 'recover': result = await installation.recover(); break;
      case 'uninstall': result = await installation.uninstall(); break;
      default: throw new Error('Use install, activate, start, health, stop, restart, recover, or uninstall.');
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
