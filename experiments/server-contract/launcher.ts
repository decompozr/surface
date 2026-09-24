import { mkdirSync, readFileSync, copyFileSync, chmodSync, symlinkSync, renameSync, existsSync, lstatSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import { Installation } from '../lifecycle/manager.ts';
import { validateRelease, migrate, restore } from './compatibility.ts';
import { projectMain } from '@decompozr/surface-cli/projects';


export const installationHome = (explicit?: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform, userHome = homedir()) => {
  if (explicit || env.SURFACE_HOME) return resolve(explicit || env.SURFACE_HOME!);
  if (platform === 'darwin') return join(userHome, 'Library/Application Support/Surface');
  if (platform === 'linux') return join(env.XDG_DATA_HOME && isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : join(userHome, '.local/share'), 'surface');
  throw new Error('This experiment supports macOS and Linux only; provide --home on other platforms.');
};

const installLauncher = async (home: string, release: string) => {
  const source = join(home, 'releases', release), directory = join(home, 'tooling', release);
  for (const path of [join(home, 'tooling'), join(home, 'bin')]) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Launcher directories must not be symlinks.');
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  let output: Awaited<ReturnType<typeof Bun.build>>;
  try { output = await Bun.build({ entrypoints: [join(source, 'experiments/server-contract/launcher.ts')], target: 'bun', format: 'esm', outdir: directory, banner: '#!/usr/bin/env bun', naming: 'launcher.js' }); }
  catch (error) { throw new Error('Launcher bundle failed: ' + String(error)); }
  if (!output.success) throw new Error('Launcher bundle failed: ' + output.logs.join('\n'));
  copyFileSync(join(source, existsSync(join(source, 'apps/cli/src/installation/runner.ts')) ? 'apps/cli/src/installation/runner.ts' : 'experiments/lifecycle/runner.ts'), join(directory, 'runner.ts'));
  chmodSync(join(directory, 'launcher.js'), 0o700);
  const temporary = join(home, 'bin', `.surface-${crypto.randomUUID()}`);
  symlinkSync(join(directory, 'launcher.js'), temporary); renameSync(temporary, join(home, 'bin/surface'));
  return join(home, 'bin/surface');
};

export const main = async (args: string[]) => {
  if (args[0] === 'project') {
    const forwarded = args.slice(1), index = forwarded.indexOf('--home');
    const explicit = index < 0 ? undefined : forwarded[index + 1];
    if (index >= 0) { if (!explicit || explicit.startsWith('--')) throw new Error('Missing --home value.'); forwarded.splice(index, 2); }
    if (forwarded.some(value => value.startsWith('--state-dir') || value.startsWith('--home'))) throw new Error('Project commands use the selected installation state; use --home PATH.');
    await projectMain(forwarded, join(installationHome(explicit), 'state'));
    return;
  }
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { home: { type: 'string' }, repo: { type: 'string' }, ref: { type: 'string' }, port: { type: 'string' }, backup: { type: 'string' }, release: { type: 'string' } } });
  const home = installationHome(values.home), installation = new Installation(home, validateRelease);
  switch (positionals[0]) {
    case 'install': case 'upgrade': {
      if (!values.repo || !values.ref) throw new Error('Specify --repo and a pinned --ref.');
      const release = await installation.install(values.repo, values.ref, 'contract', async (_directory, identity) => { await installLauncher(home, identity); });
      return { ...release, launcher: join(home, 'bin/surface') };
    }
    case 'start': return (await installation.start(values.port === undefined ? undefined : Number(values.port))).status;
    case 'status': return installation.health();
    case 'stop': return installation.stop();
    case 'restart': await installation.stop(); return (await installation.start(values.port === undefined ? undefined : Number(values.port))).status;
    case 'recover': return installation.recover();
    case 'rollback': if (!values.release) throw new Error('Specify --release.'); return installation.activate(values.release);
    case 'migrate': return installation.withStoppedState(migrate);
    case 'restore': if (!values.backup) throw new Error('Specify --backup.'); return installation.withStoppedState((state, release) => restore(state, release, values.backup!));
    case 'uninstall': return installation.uninstall();
    case 'access': {
      const connection = JSON.parse(readFileSync(join(home, 'state/connection.json'), 'utf8'));
      const response = await fetch(connection.origin + '/project-db/access', { headers: { authorization: `Bearer ${connection.token}` } });
      if (!response.ok) throw new Error('Backend access inspection failed.');
      return response.json();
    }
    default: throw new Error('Use install, upgrade, start, status, stop, restart, rollback, migrate, restore, recover, access, or uninstall.');
  }
};

if (import.meta.main) {
  try { const result = await main(process.argv.slice(2)); if (result !== undefined) console.log(JSON.stringify(result, null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
