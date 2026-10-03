/** Prepared setup acceptance: owns only short-lived fixture homes and provider links. */
import { expect } from 'bun:test';
import { mkdtempSync, realpathSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { readReleaseSelection, inspectSelectedRelease } from '@decompozr/surface-cli/installation/release-selection';
import { inventory } from '@decompozr/surface-cli/installation/bundle';

const {values} = parseArgs({options: {selection: {type: 'string'}, output: {type: 'string'}}});
if (!values.selection || !values.output) throw new Error('Use --selection RELEASE_JSON --output NEW_DIRECTORY.');
const originalSelectionPath = resolve(values.selection), output = resolve(values.output); mkdirSync(output);
const base = realpathSync(mkdtempSync('/tmp/srf-setup-')), home = join(base, 'home'), checkout = join(base, 'checkout'), skills = join(base, 'provider');
const original = readReleaseSelection(originalSelectionPath);
const fixtureSelection = join(base, 'selection'); mkdirSync(fixtureSelection);
cpSync(original.archive, join(fixtureSelection, 'candidate.tar.gz'));
const selectionPath = join(fixtureSelection, 'release.json');
// Preserve the original basename required by the archive root contract.
const archiveName = original.archive.split('/').at(-1);
if (!archiveName) throw new Error('Invalid selected archive path.');
renameSync(join(fixtureSelection, 'candidate.tar.gz'), join(fixtureSelection, archiveName));
writeFileSync(selectionPath, JSON.stringify({...original.selection, archive: archiveName}));
const prepared = await inspectSelectedRelease(selectionPath), descriptor = readReleaseSelection(selectionPath);
const reservation = createServer(); await new Promise<void>(done => reservation.listen(0, '127.0.0.1', done));
const address = reservation.address();
if (!address || typeof address === 'string') throw new Error('Fixture port reservation failed.');
const port = address.port; await new Promise<void>(done => reservation.close(() => done()));
const env: NodeJS.ProcessEnv = {...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', SURFACE_HOME: home}; delete env.SURFACE_STATE_DIR;
const run = async (args: string[], fail = false) => {
  const child = Bun.spawn(args, {cwd: checkout, env, stdout: 'pipe', stderr: 'pipe'});
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (fail) {expect(code).not.toBe(0); return err + out;}
  if (code) throw new Error(err + out); return out;
};
const setup = (...args: string[]) => run([process.execPath, '--no-install', join(checkout, 'bin/setup'), '--home', home, '--skills-dir', skills, ...args]);
const cli = async (...args: string[]) => JSON.parse(await run([join(home, 'bin/surface'), ...args, '--home', home]));
let running = false;
try {
  mkdirSync(checkout); mkdirSync(skills);
  // A checkout with no node_modules proves setup consumes the packaged installer
  // and prompt/runtime dependencies rather than bootstrapping a source build.
  for (const path of ['bin', 'apps/cli/src', 'skills/surface']) cpSync(join(prepared.directory, path), join(checkout, path), {recursive: true});
  cpSync(join(prepared.directory, 'package.json'), join(checkout, 'package.json'));
  await run([process.execPath, '--no-install', '-e', `import {configurePrompts, loadPrompts} from ${JSON.stringify(join(checkout, 'apps/cli/src/installation/setup/prompts.ts'))}; configurePrompts(${JSON.stringify(prepared.directory)}); const prompts = await loadPrompts(); if (typeof prompts.select !== 'function' || typeof prompts.note !== 'function') throw new Error('Missing packaged prompt API');`]);
  await setup('--release', selectionPath, '--port', String(port)); running = true;
  const first = await cli('status'), pid = first.lifecycle.pid;
  expect(first.lifecycle.commit).toBe(prepared.bundle.commit);
  expect(existsSync(join(checkout, 'node_modules'))).toBe(false);
  mkdirSync(join(checkout, 'docs')); writeFileSync(join(checkout, 'docs/pending.md'), 'Uncommitted release history');
  await setup(); expect((await cli('status')).lifecycle.pid).toBe(pid);
  await run([process.execPath, '--no-install', join(checkout, 'bin/test'), '--home', home, '--skills-dir', skills]);
  // A descriptor pointing at corrupt bytes is rejected before stopping anything.
  const bad = join(base, 'bad'); mkdirSync(bad);
  writeFileSync(join(bad, 'candidate.tar.gz'), 'corrupt archive');
  const saveBad = (sha256: string, bundle = prepared.bundle) => writeFileSync(join(bad, 'release.json'), JSON.stringify({...descriptor.selection, archive: 'candidate.tar.gz', sha256, bundle}));
  saveBad(prepared.sha256);
  await run([process.execPath, '--no-install', join(checkout, 'bin/setup'), '--home', home, '--skills-dir', skills, '--release', join(bad, 'release.json')], true);
  expect((await cli('status')).lifecycle.pid).toBe(pid);
  const skill = join(checkout, 'skills/surface/SKILL.md'), skillBytes = readFileSync(skill);
  writeFileSync(skill, 'Incompatible skill');
  await run([process.execPath, '--no-install', join(checkout, 'bin/setup'), '--home', home, '--skills-dir', skills, '--release', selectionPath], true);
  expect((await cli('status')).lifecycle.pid).toBe(pid); writeFileSync(skill, skillBytes);
  // Inventory-consistent malformed lifecycle metadata must also fail pre-stop.
  const malformed = join(bad, 'candidate'); cpSync(prepared.directory, malformed, {recursive: true, verbatimSymlinks: true});
  const internal = JSON.parse(readFileSync(join(malformed, '.surface-release.json'), 'utf8')); internal.commit = '0'.repeat(40);
  writeFileSync(join(malformed, '.surface-release.json'), JSON.stringify(internal));
  const malformedBundle = {...prepared.bundle, files: inventory(malformed)};
  writeFileSync(join(malformed, 'surface-release.json'), JSON.stringify(malformedBundle));
  await run(['/usr/bin/env', 'COPYFILE_DISABLE=1', 'tar', '-czf', join(bad, 'candidate.tar.gz'), '-C', bad, 'candidate']);
  saveBad(createHash('sha256').update(readFileSync(join(bad, 'candidate.tar.gz'))).digest('hex'), malformedBundle);
  const rejection = await run([process.execPath, '--no-install', join(checkout, 'bin/setup'), '--home', home, '--skills-dir', skills, '--release', join(bad, 'release.json')], true);
  expect(rejection).toContain('release metadata'); expect((await cli('status')).lifecycle.pid).toBe(pid);
  // Original artifact can disappear after installation; reuse is verified locally.
  const hidden = descriptor.archive + '.fixture-hidden'; renameSync(descriptor.archive, hidden);
  try {await setup(); await run([process.execPath, '--no-install', join(checkout, 'bin/test'), '--home', home, '--skills-dir', skills]);}
  finally {renameSync(hidden, descriptor.archive);}
  expect((await cli('status')).lifecycle.pid).toBe(pid);
  const configuration = join(home, 'agent-setup.json');
  const saved = JSON.parse(readFileSync(configuration, 'utf8')); delete saved.release;
  writeFileSync(configuration, JSON.stringify(saved)); await setup();
  expect(JSON.parse(readFileSync(configuration, 'utf8')).release).toBeUndefined();
  expect((await cli('status')).lifecycle.pid).toBe(pid);
  await cli('stop'); running = false; await setup(); running = true;
  const resumed = await cli('status'); expect(resumed.lifecycle.pid).not.toBe(pid); expect(resumed.lifecycle.origin).toBe(first.lifecycle.origin);
  expect(existsSync(join(checkout, 'node_modules'))).toBe(false);
  writeFileSync(join(output, 'report.json'), JSON.stringify({passed: true, commit: prepared.bundle.commit, sha256: prepared.sha256, checks: ['fresh packaged setup and prompt API load with auto-install disabled and no source dependencies', 'docs-only WIP reuse and read-only test', 'same PID across repeat and invalid checksum/skill/lifecycle candidates', 'removed archive repeat and test', 'legacy configuration reuse without fabricated acceptance identity', 'stopped selected release starts with saved endpoint'], limitations: ['No real provider discovery or live conversation', 'Tailscale ownership exercised by isolated unit fixtures, not live network reconfiguration']}, null, 2));
} finally {
  if (running) await cli('stop'); prepared.cleanup(); rmSync(base, {recursive: true, force: true});
}
