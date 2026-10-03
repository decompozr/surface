import { constants, mkdtempSync, mkdirSync, realpathSync, copyFileSync, chmodSync, writeFileSync, rmSync, readFileSync, existsSync, openSync, closeSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { requireCompatibleBun } from '@decompozr/surface-cli/installation/bun-version';
import { materializeDesignSystem } from '@decompozr/surface-cli/installation/design-system';
import { validateRelease } from '@decompozr/surface-cli/installation/compatibility';
import { inventory, type Bundle } from '@decompozr/surface-cli/installation/bundle';
import type { Release } from '@decompozr/surface-cli/installation/manager';

export type SourceSnapshotOptions = { repo: string; ref: string; directory: string; designSystemPackage?: string };
export type BuildOptions = { version: string; repo?: string; ref?: string; out?: string; designSystemPackage?: string };
export type BuildResult = { archive: string; checksum: string; version: string; commit: string; platform: string; arch: string };

const command = async (args: string[], cwd?: string, env = process.env): Promise<string> => {
  const child = Bun.spawn(args, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code !== 0) throw new Error(`Command failed (${code}): ${args[0]} ${args.slice(1, 4).join(' ')}\n${stderr.slice(-8000)}${stdout.slice(-8000)}`);
  return stdout.trim();
};

const readPackage = (directory: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid source package metadata.');
  return Object.fromEntries(Object.entries(value));
};

export const candidateName = (version: string, platform = process.platform, arch = process.arch): string => {
  if (!/^\d+\.\d+\.\d+-[a-z0-9.-]+$/.test(version)) throw new Error('Specify an experimental --version, e.g. 0.1.0-experiment.1');
  if (platform !== 'darwin' || arch !== 'arm64') throw new Error('This release experiment only supports native macOS arm64 builds.');
  return `surface-${version}-${platform}-${arch}`;
};

/** Publish exclusively; a failed sidecar write removes only files created by this call. */
export const publishCandidateArchive = (stagedArchive: string, archive: string): string => {
  const checksum = createHash('sha256').update(readFileSync(stagedArchive)).digest('hex');
  copyFileSync(stagedArchive, archive, constants.COPYFILE_EXCL);
  let ownedSidecar = false;
  try {
    const fd = openSync(archive + '.sha256', 'wx');
    ownedSidecar = true;
    try { writeFileSync(fd, checksum + '  ' + basename(archive) + '\n'); }
    finally { closeSync(fd); }
  } catch (error) {
    if (ownedSidecar) rmSync(archive + '.sha256', { force: true });
    rmSync(archive, { force: true });
    throw error;
  }
  return checksum;
};

/** Build only in a new, caller-owned directory. Never initialize or select an installation. */
export const prepareSourceSnapshot = async (options: SourceSnapshotOptions): Promise<Release> => {
  const repo = realpathSync(options.repo), directory = resolve(options.directory);
  if (existsSync(directory)) throw new Error('Source build requires a new output directory.');
  const commit = await command(['git', '-C', repo, 'rev-parse', '--verify', `${options.ref}^{commit}`]);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected a full Git commit identity.');
  const archive = directory + `.source-${crypto.randomUUID()}.tar`;
  mkdirSync(directory, { recursive: true });
  try {
    await command(['git', '-C', repo, 'archive', '--format=tar', `--output=${archive}`, commit]);
    await command(['tar', '-xf', archive, '-C', directory]);
    requireCompatibleBun(readPackage(directory).packageManager, Bun.version);
    await command([process.execPath, 'install', '--frozen-lockfile', '--ignore-scripts'], directory);
    const dependencies = readPackage(join(directory, 'apps/surface')).dependencies;
    if (typeof dependencies === 'object' && dependencies !== null && !Array.isArray(dependencies)) {
      const designSystem: unknown = Object.fromEntries(Object.entries(dependencies))['@decompozr/design-system'];
      if (typeof designSystem === 'string' && designSystem.startsWith('link:')) {
        materializeDesignSystem(repo, directory, options.designSystemPackage && resolve(options.designSystemPackage));
      }
    }
    await command([process.execPath, 'run', 'build'], join(directory, 'apps/surface'));
    await validateRelease(directory, join(directory, '.candidate-validation-state'));
    const manifest: Release = { version: 1, release: `${commit}-surface`, commit, host: 'surface', bun: Bun.version, installedAt: new Date().toISOString() };
    writeFileSync(join(directory, '.surface-release.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    return manifest;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(archive, { force: true });
  }
};

/** Produce the complete installer archive; publication and service management are separate. */
export const buildCandidate = async (options: BuildOptions): Promise<BuildResult> => {
  const name = candidateName(options.version);
  const repo = resolve(options.repo ?? join(import.meta.dir, '..'));
  const out = resolve(options.out ?? join(repo, 'dist'));
  const archive = join(out, name + '.tar.gz');
  if (existsSync(archive) || existsSync(archive + '.sha256')) throw new Error('Refusing to overwrite an existing versioned archive or checksum.');
  const temp = realpathSync(mkdtempSync('/tmp/surface-build-'));
  try {
    const folder = join(temp, name);
    const manifest = await prepareSourceSnapshot({ repo, ref: options.ref ?? 'HEAD', directory: folder, designSystemPackage: options.designSystemPackage });
    const assets = join(folder, '.distribution');
    mkdirSync(assets);
    copyFileSync(process.execPath, join(assets, 'bun'));
    chmodSync(join(assets, 'bun'), 0o755);
    copyFileSync(join(folder, 'apps/cli/src/installation/runner.ts'), join(assets, 'runner.ts'));
    const result = await Bun.build({ entrypoints: [join(folder, 'apps/cli/src/installation/launcher.ts')], target: 'bun', format: 'esm', outdir: assets, naming: 'launcher.js' });
    if (!result.success) throw new Error(String(result.logs));
    writeFileSync(join(folder, 'install'), `#!/bin/sh\nset -eu\nrelease_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$release_dir/.distribution/bun" "$release_dir/.distribution/launcher.js" install --bundle "$release_dir" "$@"\n`, { mode: 0o755 });
    const bundle: Bundle = { format: 1, version: options.version, commit: manifest.commit, platform: process.platform, arch: process.arch, bun: Bun.version, files: inventory(folder) };
    writeFileSync(join(folder, 'surface-release.json'), JSON.stringify(bundle, null, 2) + '\n');
    // Complete the archive in private staging, then create the public files exclusively.
    const stagedArchive = join(temp, name + '.tar.gz');
    // macOS extended attributes otherwise create AppleDouble entries outside the payload inventory.
    await command(['tar', '-czf', stagedArchive, '-C', temp, name], undefined, { ...process.env, COPYFILE_DISABLE: '1' });
    mkdirSync(out, { recursive: true });
    const checksum = publishCandidateArchive(stagedArchive, archive);
    return { archive, checksum, version: options.version, commit: manifest.commit, platform: process.platform, arch: process.arch };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

export const buildCommand = async (args: string[]): Promise<BuildResult> => {
  const { values } = parseArgs({ args, options: { version: { type: 'string' }, ref: { type: 'string' }, out: { type: 'string' }, 'design-system-package': { type: 'string' } } });
  if (!values.version) throw new Error('Specify an experimental --version, e.g. 0.1.0-experiment.1');
  return buildCandidate({ version: values.version, ref: values.ref, out: values.out, designSystemPackage: values['design-system-package'] });
};
