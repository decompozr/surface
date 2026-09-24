import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const designSystemIdentity = (root: string) => {

  const visit = (path: string) => {
    const absolute = join(root, path), stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Design-system package contains a symlink: ${path}`);
    if (stat.isDirectory()) for (const name of readdirSync(absolute).sort()) visit(`${path}/${name}`);
    else if (stat.isFile()) files.push({ path, sha256: sha(readFileSync(absolute)) });
    else throw new Error(`Unsupported package entry: ${path}`);
  };

  const files: { path: string; sha256: string }[] = [];
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.name !== packageName || !existsSync(join(root, 'dist/index.js'))) throw new Error('Build the selected design-system package before installing Surface.');
  visit('package.json'); visit('dist');
  return { version: 1, name: packageName, packageVersion: pkg.version, fileCount: files.length, sha256: sha(JSON.stringify(files)) };
};


/** Development stays linked; a prepared release owns a verified immutable copy. */
export const materializeDesignSystem = (repo: string, release: string, packageDirectory?: string) => {
  const pinPath = join(release, 'apps/surface/design-system.lock.json');
  if (!existsSync(pinPath)) throw new Error('Surface release must pin its linked design-system package.');
  const expected = JSON.parse(readFileSync(pinPath, 'utf8'));
  const source = realpathSync(packageDirectory ?? join(repo, 'apps/surface/node_modules', packageName));
  const observed = designSystemIdentity(source);
  if (expected.version !== 1 || expected.name !== packageName || expected.sha256 !== observed.sha256) {
    throw new Error('Linked design-system package differs from the committed pin. Build/link the recorded provider revision before updating Surface.');
  }
  const target = join(release, 'apps/surface/node_modules', packageName);
  // release is this installer's unpublished staging directory; never mutate the
  // developer package or follow the staging dependency symlink during removal.
  rmSync(target, { force: true, recursive: true }); mkdirSync(dirname(target), { recursive: true });
  mkdirSync(target);
  cpSync(join(source, 'package.json'), join(target, 'package.json'));
  cpSync(join(source, 'dist'), join(target, 'dist'), { recursive: true });
  const copied = designSystemIdentity(target);
  if (copied.sha256 !== expected.sha256) throw new Error('Design-system package changed during release preparation.');
  writeFileSync(join(release, '.surface-design-system.json'), JSON.stringify({ ...copied, providerCommit: expected.providerCommit }, null, 2) + '\n');
};


const packageName = '@decompozr/design-system';
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
