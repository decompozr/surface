import { selectAccess, reconcileAccess } from './tailscale.ts';
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { loadPrompts, configurePrompts } from './prompts.ts';
import { selectSkills } from './provider.ts';
import { requireCompatibleBun } from '../bun-version.ts';
import { installationHome } from '../paths.ts';
import { inspectSkillLink, linkSkill } from './skill-link.ts';
import { inspectSelectedRelease } from '../release-selection.ts';
import { sameBundle, verifyBundle } from '../bundle.ts';
import { validateRelease } from '../compatibility.ts';
import { object, string } from '../json.ts';
import { installedBundle, parseSetupSelection, requireSelectedBundle, verifyCheckoutCompatibility, type InstalledSelection } from './selection.ts';

export const agentSetup = async (args = process.argv.slice(2)) => {
  const {values, positionals} = parseArgs({args, allowPositionals: true, options: {home: {type: 'string'}, 'skills-dir': {type: 'string', multiple: true}, provider: {type: 'string', multiple: true}, port: {type: 'string'}, tailscale: {type: 'string'}, release: {type: 'string'}, help: {type: 'boolean'}}});
  if (values.help) {
    console.log('./bin/setup [--release /absolute/release.json] | ./bin/test [--provider codex|claude | --skills-dir PATH] [--home PATH] [--port PORT] [--tailscale on|off]\nBuild once with ./bin/build, verify/select with ./bin/release, then setup consumes its packaged installer. Saved selections are reused without building.'); return;
  }
  const mode = positionals[0];
  if ((mode !== 'setup' && mode !== 'test') || positionals.length !== 1) throw new Error('Specify setup or test.');
  if (mode === 'test' && (values.release || values.tailscale || values.port)) throw new Error('Test is read-only; use setup to select a release or change access.');
  if (values.release && !values.release.startsWith('/')) throw new Error('Use an absolute --release path.');
  const root = resolve(import.meta.dir, '../../../../..'), home = installationHome(values.home), launcher = join(home, 'bin/surface');
  const pkg: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!object(pkg) || !string(pkg.packageManager)) throw new Error('Invalid checkout package manager contract.');
  requireCompatibleBun(pkg.packageManager, Bun.version);
  if (values.port !== undefined && (!Number.isInteger(Number(values.port)) || Number(values.port) < 0 || Number(values.port) > 65535)) throw new Error('Invalid port.');
  const configuration = join(home, 'agent-setup.json');
  const saved = existsSync(configuration) ? parseSetupSelection(JSON.parse(readFileSync(configuration, 'utf8'))) : undefined;
  // An explicit bad selection never falls back to an installed or saved release.
  const prepared = values.release ? await inspectSelectedRelease(values.release) : undefined;
  try {
    const installed = installedBundle(home);
    if (!prepared && !installed) throw new Error('No installed release selected. Run ./bin/build, then ./bin/release --archive ARCHIVE --acceptance RECEIPT --out DIRECTORY, then ./bin/setup --release /absolute/DIRECTORY/release.json.');
    const bundle = prepared?.bundle ?? installed?.bundle;
    if (!bundle) throw new Error('No verified release available.');
    if (!prepared && saved?.release) requireSelectedBundle(bundle, saved.release.bundle);
    if (prepared && existsSync(join(home, 'releases', bundle.commit + '-surface'))) {
      const existing = verifyBundle(join(home, 'releases', bundle.commit + '-surface'), false);
      if (!sameBundle(existing, bundle)) throw new Error('Same-source installed package differs from this release; preserved the running service. Select a distinct source revision.');
    }
    verifyCheckoutCompatibility(root, bundle);
    if (prepared) await validateRelease(prepared.directory, join(home, 'state'));
    const release: InstalledSelection | undefined = prepared ? {sha256: prepared.sha256, bundle} : saved?.release;
    configurePrompts(prepared?.directory ?? installed?.directory ?? root);
    const interactive = !!process.stdin.isTTY && !!process.stdout.isTTY;
    const ui = interactive ? await loadPrompts() : undefined;
    ui?.intro('Surface · ' + mode);
    const step = (message: string) => { ui?.log.step(message); };
    let access = mode === 'test' ? saved?.access ?? {enabled: false} : await selectAccess(saved?.access, values.tailscale, interactive);
    const skills = await selectSkills({explicit: values['skills-dir'], provider: values.provider, saved: saved?.skillsDirectories, mode});
    for (const directory of skills) inspectSkillLink(root, directory);
    if (ui) ui.note(`Install  ${home}\n\n` + skills.map(directory => `Link     ${join(directory, 'surface')}`).join('\n'), 'Your setup');
    else console.log(`Surface ${mode}: ${home}`);
    const env: NodeJS.ProcessEnv = {...process.env, SURFACE_HOME: home}; delete env.SURFACE_STATE_DIR;
    const run = async (command: string[]) => {
      const child = Bun.spawn(command, {cwd: root, env, stdout: 'pipe', stderr: 'pipe'});
      const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      if (code) throw new Error(err + out); return out.trim();
    };
    const cli = async (...command: string[]): Promise<unknown> => JSON.parse(await run([launcher, ...command, '--home', home]));
    const saveSelection = () => {
      const content = JSON.stringify({version: 3, skillsDirectories: skills, access, ...(release ? {release} : {})}, null, 2) + '\n';
      if (!existsSync(configuration) || readFileSync(configuration, 'utf8') !== content) {
        const temporary = configuration + '.tmp'; writeFileSync(temporary, content, {mode: 0o600}); renameSync(temporary, configuration);
      }
    };
    const verify = async (): Promise<void> => {
      const skillLinks = skills.map(directory => inspectSkillLink(root, directory));
      if (skillLinks.some(skill => !skill.linked)) throw new Error('Provider skill link is missing. Run setup first.');
      const actual = installedBundle(home);
      if (!actual) throw new Error('Installed release is missing.');
      requireSelectedBundle(actual.bundle, bundle);
      const status = await cli('status');
      if (!object(status) || status.status !== 'running' || !object(status.lifecycle) || !string(status.lifecycle.origin) || !string(status.lifecycle.instanceId) || status.lifecycle.commit !== bundle.commit) throw new Error('Selected Surface is not running with the verified release.');
      const lifecycle = status.lifecycle, origin = status.lifecycle.origin;
      const doctor = await cli('doctor');
      const response = await fetch(origin + '/health');
      const health: unknown = await response.json();
      if (!response.ok || !object(health) || !object(health.runtime) || health.runtime.instanceId !== lifecycle.instanceId) throw new Error('Installed app health does not match the selected service.');
      const network = await reconcileAccess(access, origin, mode === 'test'); access = network.access;
      if (mode !== 'test') saveSelection();
      if (lifecycle.browserOrigin !== network.url) {
        if (mode === 'test') throw new Error('Running host does not accept the configured Tailscale origin. Run ./bin/setup.');
        step('Applying the private browser hostname'); await cli('stop'); await cli('start', '--port', new URL(origin).port); await verify(); return;
      }
      if (network.url) {
        const remoteHost = await fetch(origin + '/health', {headers: {host: new URL(network.url).host, origin: network.url}, signal: AbortSignal.timeout(5000)});
        if (!remoteHost.ok) throw new Error('Configured Tailscale hostname was rejected by the installed host.');
      }
      if (ui) {ui.note(`Open     ${origin}${network.url ? '\nTailscale ' + network.url : ''}\n\nSkills   ${skillLinks.length} linked to this checkout\nManage   ${launcher} status`, 'Ready'); ui.outro('Surface is running.');}
      else console.log(JSON.stringify({status: 'verified', home, launcher, origin, tailscale: network.url, release: lifecycle.release, version: bundle.version, sha256: release?.sha256, skillLinks, doctor, agentDiscovery: 'Reload the provider if needed. Linking does not prove discovery or live delivery.'}, null, 2));
    };
    if (mode === 'test') {await verify(); return;}
    const status = installed && existsSync(launcher) ? await cli('status') : undefined;
    const wasRunning = object(status) && status.status === 'running';
    const matching = installed !== undefined && sameBundle(installed.bundle, bundle);
    let portChanged = false;
    if (values.port !== undefined && existsSync(join(home, 'settings.json'))) {
      const settings: unknown = JSON.parse(readFileSync(join(home, 'settings.json'), 'utf8'));
      if (!object(settings) || typeof settings.port !== 'number') throw new Error('Invalid installation settings.');
      portChanged = settings.port !== Number(values.port);
    }
    if (wasRunning && (!matching || portChanged)) {step('Stopping the selected service for update'); await cli('stop');}
    try {
      if (!matching) {
        if (!prepared) throw new Error('Select a verified release with --release before installing.');
        step('Installing the selected prepared release');
        await run([join(prepared.directory, 'install'), '--home', home]);
      } else step('Reusing the verified installation');
      for (const directory of skills) linkSkill(root, directory);
      if (!wasRunning || !matching || portChanged) await cli('start', ...(values.port !== undefined ? ['--port', values.port] : []));
      await verify();
    } catch (error) {
      if (wasRunning && existsSync(launcher)) try {const current = await cli('status'); if (object(current) && current.status === 'stopped') await cli('start');} catch {}
      throw error;
    }
  } finally {prepared?.cleanup();}
};

if (import.meta.main) agentSetup().catch(error => {console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1;});
