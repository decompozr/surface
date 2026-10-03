import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdtempSync, realpathSync, rmSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseBundle, sameBundle, verifyBundle, type Bundle } from './bundle.ts';
import { parseRelease } from './manager.ts';
import { requireCompatibleBun } from './bun-version.ts';
import { designSystemIdentity } from './design-system.ts';
import { object, string, digest, commit } from './json.ts';

export type ReleaseSelection = { format: 1; archive: string; sha256: string; bundle: Bundle };
export type ProviderIdentity = { commit: string; packageSha256: string };
const confined = (path: string) => !!path && !isAbsolute(path) && !path.includes('\\') && path.split('/').every(part => part !== '..' && part !== '.' && part !== '');

export const readReleaseSelection = (path: string): {selection: ReleaseSelection; archive: string} => {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!object(value) || value.format !== 1 || !string(value.archive) || !confined(value.archive) || !string(value.sha256) || !digest(value.sha256)) throw new Error('Invalid release selection. Run ./bin/release for a verified candidate.');
  const archive = realpathSync(resolve(dirname(path), value.archive));
  if (!confined(relative(realpathSync(dirname(path)), archive))) throw new Error('Selected archive escapes its release directory.');
  return {selection: {format: 1, archive: value.archive, sha256: value.sha256, bundle: parseBundle(value.bundle)}, archive};
};

export const verifyProvider = (directory: string): ProviderIdentity => {
  const pin: unknown = JSON.parse(readFileSync(join(directory, 'apps/surface/design-system.lock.json'), 'utf8'));
  const receipt: unknown = JSON.parse(readFileSync(join(directory, '.surface-design-system.json'), 'utf8'));
  if (!object(pin) || pin.version !== 1 || pin.name !== '@decompozr/design-system' || !commit(pin.providerCommit) || !string(pin.sha256) || !digest(pin.sha256)
    || !object(receipt) || receipt.providerCommit !== pin.providerCommit || receipt.sha256 !== pin.sha256) throw new Error('Invalid bundled design-system identity.');
  const observed = designSystemIdentity(join(directory, 'apps/surface/node_modules/@decompozr/design-system'));
  if (observed.sha256 !== pin.sha256) throw new Error('Bundled design-system package differs from its pin.');
  return {commit: pin.providerCommit, packageSha256: pin.sha256};
};

// Inspect TAR records before extraction: never let archive paths, links, or special
// entries write outside the private staging directory. PAX paths are authoritative.
export const validateArchivePaths = (bytes: Buffer, root: string) => {
  const tar = gunzipSync(bytes), entries = new Map<string, string>();
  let attributes: Record<string, string> = {}, global: Record<string, string> = {};
  const field = (header: Buffer, start: number, length: number) => header.subarray(start, start + length).toString('utf8').split('\0')[0] ?? '';
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const size = Number.parseInt(field(header, 124, 12).trim(), 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid release archive size.');
    const type = field(header, 156, 1), data = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x' || type === 'g') {
      const values: Record<string, string> = {};
      for (let at = 0; at < data.length;) {
        const space = data.indexOf(32, at), count = Number(data.subarray(at, space).toString());
        if (space < at || !Number.isSafeInteger(count) || count <= space - at + 1 || at + count > data.length) throw new Error('Invalid PAX archive record.');
        const record = data.subarray(space + 1, at + count - 1).toString(), equal = record.indexOf('=');
        if (equal < 1) throw new Error('Invalid PAX archive attribute.');
        values[record.slice(0, equal)] = record.slice(equal + 1); at += count;
      }
      if (type === 'g') global = {...global, ...values}; else attributes = values;
      continue;
    }
    const attrs = {...global, ...attributes}; attributes = {};
    if (attrs.size !== undefined && Number(attrs.size) !== size) throw new Error('Unsupported PAX size override.');
    const prefix = field(header, 345, 155), name = (attrs.path ?? (prefix ? prefix + '/' : '') + field(header, 0, 100)).replace(/\/$/, '');
    if (!confined(name) || (name !== root && !name.startsWith(root + '/')) || name.includes('\0')) throw new Error('Release archive path escapes its root.');
    if (!['', '0', '2', '5'].includes(type)) throw new Error('Unsupported release archive entry.');
    if (entries.has(name)) throw new Error('Duplicate release archive path.');
    entries.set(name, type);
    if (type === '2') {
      const target = attrs.linkpath ?? field(header, 157, 100);
      const destination = posix.normalize(posix.join(posix.dirname(name), target));
      if (isAbsolute(target) || target.includes('\\') || (destination !== root && !destination.startsWith(root + '/'))) throw new Error('Release archive link escapes its root.');
    }
  }
  if (!entries.has(root)) throw new Error('Release archive root is missing.');
  for (const path of entries.keys()) {
    for (let parent = posix.dirname(path); parent !== '.'; parent = posix.dirname(parent)) {
      if (entries.get(parent) === '2') throw new Error('Release archive writes through a symlink.');
    }
  }
};

export const verifyPreparedMetadata = (directory: string, bundle: Bundle) => {
  const manifest = parseRelease(JSON.parse(readFileSync(join(directory, '.surface-release.json'), 'utf8')));
  if (manifest.commit !== bundle.commit || manifest.bun !== bundle.bun) throw new Error('Bundle lifecycle identity mismatch.');
  const pkg: unknown = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  if (!object(pkg) || !string(pkg.packageManager)) throw new Error('Invalid bundled package manager contract.');
  requireCompatibleBun(pkg.packageManager, bundle.bun, manifest.bun);
};

export const inspectReleaseArchive = async (archive: string, expectedSha256?: string) => {
  const absolute = realpathSync(archive), bytes = readFileSync(absolute);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expectedSha256 !== undefined && (!digest(expectedSha256) || sha256 !== expectedSha256)) throw new Error('Release archive checksum mismatch.');
  const root = basename(absolute).replace(/\.tar\.gz$/, '');
  if (root === basename(absolute)) throw new Error('Select a .tar.gz release archive.');
  validateArchivePaths(bytes, root);
  const staging = realpathSync(mkdtempSync(join(tmpdir(), 'surface-release-')));
  const cleanup = () => rmSync(staging, {recursive: true, force: true});
  try {
    // Extract the already-hashed bytes, avoiding a changed-file race.
    const child = Bun.spawn(['tar', '-xzf', '-', '-C', staging, '--no-same-owner'], {stdin: bytes, stdout: 'pipe', stderr: 'pipe'});
    const [code, error] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (code) throw new Error('Release extraction failed: ' + error);
    const directory = join(staging, root), bundle = verifyBundle(directory, false), provider = verifyProvider(directory);
    verifyPreparedMetadata(directory, bundle);
    if (!existsSync(join(directory, 'install')) || !lstatSync(join(directory, 'install')).isFile()) throw new Error('Release package has no installer.');
    for (const name of ['bun', 'launcher.js', 'runner.ts']) if (!lstatSync(join(directory, '.distribution', name)).isFile()) throw new Error('Release runtime payload is incomplete.');
    const runtime = Bun.spawn([join(directory, '.distribution/bun'), '--version'], {stdout: 'pipe', stderr: 'pipe'});
    const [runtimeCode, runtimeVersion] = await Promise.all([runtime.exited, new Response(runtime.stdout).text()]);
    if (runtimeCode || runtimeVersion.trim() !== bundle.bun) throw new Error('Bundled Bun runtime differs from release metadata.');
    return {directory, bundle, provider, sha256, cleanup};
  } catch (error) {cleanup(); throw error;}
};

export const inspectSelectedRelease = async (path: string) => {
  const {selection, archive} = readReleaseSelection(path);
  const result = await inspectReleaseArchive(archive, selection.sha256);
  if (!sameBundle(result.bundle, selection.bundle)) { result.cleanup(); throw new Error('Selected release metadata differs from the archive.'); }
  return {...result, selection};
};
