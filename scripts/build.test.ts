import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCandidate, candidateName, prepareSourceSnapshot, publishCandidateArchive } from './build.ts';

const roots: string[] = [];
const fixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'surface-builder-test-'));
  roots.push(root);
  return root;
};
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const git = (root: string, args: string[]): string => {
  const result = Bun.spawnSync(['git', '-C', root, ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
};

test('candidate paths require prerelease identity and the supported native platform', () => {
  expect(candidateName('0.1.0-rc.1', 'darwin', 'arm64')).toBe('surface-0.1.0-rc.1-darwin-arm64');
  for (const version of ['0.1.0', '0.1.0-../../overwrite', '0.1.0-RC']) {
    expect(() => candidateName(version, 'darwin', 'arm64')).toThrow('experimental --version');
  }
  expect(() => candidateName('0.1.0-rc.1', 'linux', 'arm64')).toThrow('native macOS arm64');
});

test('existing candidate sidecar is preserved before any source preparation', async () => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return;
  const out = fixture(), version = '0.1.0-rc.1';
  const sidecar = join(out, candidateName(version) + '.tar.gz.sha256');
  writeFileSync(sidecar, 'owned existing checksum');
  await expect(buildCandidate({ version, out, repo: '/missing-source' })).rejects.toThrow('Refusing to overwrite');
  expect(readFileSync(sidecar, 'utf8')).toBe('owned existing checksum');
  expect(existsSync(sidecar.slice(0, -7))).toBe(false);
});

test('source build exports the committed revision and removes failed private preparation', async () => {
  const repo = fixture(), outputRoot = fixture(), directory = join(outputRoot, 'candidate');
  git(repo, ['init', '--quiet']);
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ packageManager: 'invalid-committed-runtime' }));
  git(repo, ['add', 'package.json']);
  git(repo, ['-c', 'user.name=Surface fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
  const ref = git(repo, ['rev-parse', 'HEAD']);
  const workingPackage = JSON.stringify({ packageManager: `bun@${Bun.version}` });
  writeFileSync(join(repo, 'package.json'), workingPackage);
  await expect(prepareSourceSnapshot({ repo, ref, directory })).rejects.toThrow('stable Bun packageManager');
  expect(existsSync(directory)).toBe(false);
  expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(workingPackage);
  expect(git(repo, ['rev-parse', 'HEAD'])).toBe(ref);
});

test('source build refuses an existing output without touching its contents', async () => {
  const directory = fixture();
  writeFileSync(join(directory, 'draft'), 'preserved');
  await expect(prepareSourceSnapshot({ repo: directory, ref: 'HEAD', directory })).rejects.toThrow('new output directory');
  expect(readFileSync(join(directory, 'draft'), 'utf8')).toBe('preserved');
});

test('sidecar conflict after archive publication rolls back only the new archive', () => {
  const root = fixture(), staged = join(root, 'staged'), archive = join(root, 'candidate.tar.gz');
  writeFileSync(staged, 'candidate bytes');
  writeFileSync(archive + '.sha256', 'concurrently published foreign checksum');
  expect(() => publishCandidateArchive(staged, archive)).toThrow();
  expect(existsSync(archive)).toBe(false);
  expect(readFileSync(archive + '.sha256', 'utf8')).toBe('concurrently published foreign checksum');
  expect(readFileSync(staged, 'utf8')).toBe('candidate bytes');
});

test('archive publication conflict preserves the existing archive and checksum', () => {
  const root = fixture(), staged = join(root, 'staged'), archive = join(root, 'candidate.tar.gz');
  writeFileSync(staged, 'new bytes');
  writeFileSync(archive, 'existing bytes');
  writeFileSync(archive + '.sha256', 'existing checksum');
  expect(() => publishCandidateArchive(staged, archive)).toThrow();
  expect(readFileSync(archive, 'utf8')).toBe('existing bytes');
  expect(readFileSync(archive + '.sha256', 'utf8')).toBe('existing checksum');
});
