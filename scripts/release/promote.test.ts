import { afterAll, beforeAll, expect, test } from 'bun:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { inventory, type Bundle } from '@decompozr/surface-cli/installation/bundle';
import { designSystemIdentity } from '@decompozr/surface-cli/installation/design-system';
import { readReleaseSelection } from '@decompozr/surface-cli/installation/release-selection';
import { promoteRelease, type AcceptanceReceipt } from './promote.ts';

const root = mkdtempSync(join(tmpdir(), 'surface-promotion-test-'));
type Fixture = { archive: string; receipt: AcceptanceReceipt };
let candidate: Fixture;
let successor: Fixture;
const fixture = async (name: string, commit: string, mutate?: (directory: string) => void): Promise<Fixture> => {
  const directory = join(root, name);
  const provider = join(directory, 'apps/surface/node_modules/@decompozr/design-system');
  mkdirSync(join(provider, 'dist'), { recursive: true });
  writeFileSync(join(provider, 'package.json'), JSON.stringify({ name: '@decompozr/design-system', version: '0.0.0' }));
  writeFileSync(join(provider, 'dist/index.js'), 'export const fixture = true;');
  const identity = { ...designSystemIdentity(provider), providerCommit: 'b'.repeat(40) };
  writeFileSync(join(directory, 'apps/surface/design-system.lock.json'), JSON.stringify(identity));
  writeFileSync(join(directory, '.surface-design-system.json'), JSON.stringify(identity));
  mkdirSync(join(directory, '.distribution'));
  copyFileSync(process.execPath, join(directory, '.distribution/bun'));
  writeFileSync(join(directory, '.distribution/launcher.js'), 'console.log("fixture");');
  writeFileSync(join(directory, '.distribution/runner.ts'), 'console.log("fixture");');
  writeFileSync(join(directory, 'install'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ packageManager: 'bun@1.4.0' }));
  writeFileSync(join(directory, '.surface-release.json'), JSON.stringify({ version: 1, release: commit + '-surface', commit, host: 'surface', bun: Bun.version, installedAt: '2026-10-01T00:00:00.000Z' }));
  mutate?.(directory);
  const bundle: Bundle = { format: 1, version: '0.1.0-test.1', commit, platform: process.platform, arch: process.arch, bun: Bun.version, files: inventory(directory) };
  writeFileSync(join(directory, 'surface-release.json'), JSON.stringify(bundle));
  const archive = join(root, name + '.tar.gz');
  const command = Bun.spawn(['tar', '-czf', archive, '-C', root, name], { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdout: 'pipe', stderr: 'pipe' });
  const [code, error] = await Promise.all([command.exited, new Response(command.stderr).text()]);
  if (code) throw new Error(error);
  return { archive, receipt: { format: 1, sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), commit,
    provider: { commit: identity.providerCommit, packageSha256: identity.sha256 },
    gates: { source: { status: 'pass' }, comments: { status: 'pass' }, lifecycle: { status: 'pass' }, visual: { status: 'pass', phone: true, desktop: true, findingsResolved: true } } } };
};
beforeAll(async () => { candidate = await fixture('candidate', 'a'.repeat(40)); successor = await fixture('successor', 'c'.repeat(40)); }, 120_000);
afterAll(() => rmSync(root, { recursive: true, force: true }));
const options = (input: Fixture, receipt: unknown = input.receipt) => {
  const directory = mkdtempSync(join(root, 'run-'));
  const acceptance = join(directory, 'receipt.json');
  writeFileSync(acceptance, JSON.stringify(receipt));
  return { archive: input.archive, acceptance, out: join(directory, 'output') };
};

test('promotion selects the same verified bytes, retains receipt, is idempotent and supports portable selection', async () => {
  const args = options(candidate);
  const selected = await promoteRelease(args);
  const descriptor = join(args.out, 'release.json');
  const loaded = readReleaseSelection(descriptor);
  expect(loaded.selection).toEqual(selected);
  expect(readFileSync(loaded.archive)).toEqual(readFileSync(candidate.archive));
  expect(JSON.parse(readFileSync(join(args.out, 'releases', selected.sha256, 'acceptance.json'), 'utf8'))).toEqual(candidate.receipt);
  expect(await promoteRelease(args)).toEqual(selected);
  const moved = join(args.out, '..', 'moved');
  renameSync(args.out, moved);
  expect(readReleaseSelection(join(moved, 'release.json')).archive).toBe(realpathSync(join(moved, selected.archive)));
}, 30_000);

test('a new accepted candidate replaces only the selection and keeps previous immutable archive', async () => {
  const args = options(candidate);
  const first = await promoteRelease(args);
  const nextArgs = options(successor);
  const next = await promoteRelease({ ...nextArgs, out: args.out });
  expect(readReleaseSelection(join(args.out, 'release.json')).selection).toEqual(next);
  expect(readFileSync(join(args.out, first.archive))).toEqual(readFileSync(candidate.archive));
}, 30_000);

test('missing, failing, malformed and identity-mismatched evidence cannot replace a selection', async () => {
  const args = options(candidate);
  await promoteRelease(args);
  const before = readFileSync(join(args.out, 'release.json'));
  const failures: unknown[] = [null, {}, { ...candidate.receipt, gates: {} },
    { ...candidate.receipt, gates: { ...candidate.receipt.gates, comments: { status: 'fail' } } },
    { ...candidate.receipt, gates: { ...candidate.receipt.gates, visual: { status: 'limited', phone: true, desktop: true, findingsResolved: true, limitation: '' } } },
    { ...candidate.receipt, gates: { ...candidate.receipt.gates, visual: { status: 'limited', phone: true, desktop: true, findingsResolved: false, limitation: 'unresolved overlap' } } },
    { ...candidate.receipt, commit: 'd'.repeat(40) },
    { ...candidate.receipt, provider: { ...candidate.receipt.provider, packageSha256: 'e'.repeat(64) } }];
  for (const receipt of failures) {
    const bad = options(candidate, receipt);
    await expect(promoteRelease({ ...bad, out: args.out })).rejects.toThrow();
    expect(readFileSync(join(args.out, 'release.json'))).toEqual(before);
  }
  const malformed = options(candidate);
  writeFileSync(malformed.acceptance, '{');
  await expect(promoteRelease({ ...malformed, out: args.out })).rejects.toThrow();
  await expect(promoteRelease({ ...args, acceptance: join(root, 'missing-receipt.json') })).rejects.toThrow();
  expect(readFileSync(join(args.out, 'release.json'))).toEqual(before);
}, 30_000);

test('tampered archive and conflicting immutable output preserve existing selection', async () => {
  const args = options(candidate);
  const selected = await promoteRelease(args);
  const before = readFileSync(join(args.out, 'release.json'));
  const tampered = join(root, 'tampered.tar.gz');
  writeFileSync(tampered, Buffer.concat([readFileSync(candidate.archive), Buffer.from('changed')]));
  await expect(promoteRelease({ ...args, archive: tampered })).rejects.toThrow('checksum');
  writeFileSync(join(args.out, selected.archive), 'collision');
  await expect(promoteRelease(args)).rejects.toThrow('conflicting');
  expect(readFileSync(join(args.out, 'release.json'))).toEqual(before);
  expect(readFileSync(join(args.out, selected.archive), 'utf8')).toBe('collision');
}, 30_000);

test('limited physical-device evidence still requires completed phone and desktop review', async () => {
  const receipt = { ...candidate.receipt, gates: { ...candidate.receipt.gates, visual: { status: 'limited', phone: true, desktop: true, findingsResolved: true, limitation: 'Physical iPhone keyboard acceptance remains unverified; rendered browser profiles passed.' } } };
  await expect(promoteRelease(options(candidate, receipt))).resolves.toBeDefined();
  await expect(promoteRelease(options(candidate, { ...receipt, gates: { ...receipt.gates, visual: { ...receipt.gates.visual, phone: false } } }))).rejects.toThrow('phone');
}, 30_000);

test('a conflicting symlink output never receives release writes', async () => {
  const args = options(candidate);
  mkdirSync(args.out);
  const unrelated = mkdtempSync(join(root, 'unrelated-'));
  symlinkSync(unrelated, join(args.out, 'releases'));
  await expect(promoteRelease(args)).rejects.toThrow('symlink');
  expect(readdirSync(unrelated)).toEqual([]);
}, 30_000);

test('public release command publishes a selection and reports input errors without building', async () => {
  const args = options(candidate);
  const entry = join(import.meta.dir, '../../bin/release');
  const child = Bun.spawn([process.execPath, entry, '--archive', args.archive, '--acceptance', args.acceptance, '--out', args.out], { stdout: 'pipe', stderr: 'pipe' });
  const [code, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect(error).toBe('');
  expect(code).toBe(0);
  expect(JSON.parse(output)).toEqual(readReleaseSelection(join(args.out, 'release.json')).selection);
  const invalid = Bun.spawn([process.execPath, entry, '--archive', args.archive], { stdout: 'pipe', stderr: 'pipe' });
  const [invalidCode, invalidError] = await Promise.all([invalid.exited, new Response(invalid.stderr).text()]);
  expect(invalidCode).toBe(1);
  expect(invalidError).toContain('Usage: ./bin/release');
}, 30_000);

test('promotion rejects inventory-consistent missing or mismatched lifecycle and runtime metadata', async () => {
  const args = options(candidate);
  await promoteRelease(args);
  const before = readFileSync(join(args.out, 'release.json'));
  const variants: { name: string; mutate: (directory: string) => void; error: string }[] = [
    { name: 'missing-lifecycle', mutate: directory => rmSync(join(directory, '.surface-release.json')), error: 'ENOENT' },
    { name: 'wrong-lifecycle-source', mutate: directory => {
      const commit = 'd'.repeat(40);
      writeFileSync(join(directory, '.surface-release.json'), JSON.stringify({ version: 1, release: commit + '-surface', commit, host: 'surface', bun: Bun.version, installedAt: '2026-10-01T00:00:00.000Z' }));
    }, error: 'lifecycle identity mismatch' },
    { name: 'wrong-lifecycle-runtime', mutate: directory => {
      const commit = 'a'.repeat(40);
      writeFileSync(join(directory, '.surface-release.json'), JSON.stringify({ version: 1, release: commit + '-surface', commit, host: 'surface', bun: '1.4.999', installedAt: '2026-10-01T00:00:00.000Z' }));
    }, error: 'lifecycle identity mismatch' },
    { name: 'incompatible-runtime', mutate: directory => writeFileSync(join(directory, 'package.json'), JSON.stringify({ packageManager: 'bun@1.5.0' })), error: 'Use Bun' },
  ];
  for (const variant of variants) {
    const invalid = await fixture(variant.name, 'a'.repeat(40), variant.mutate);
    await expect(promoteRelease({ ...options(invalid), out: args.out })).rejects.toThrow(variant.error);
    expect(readFileSync(join(args.out, 'release.json'))).toEqual(before);
  }
}, 60_000);
