import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inventory, parseBundle, sameBundle, sameInventory, verifyBundle, type Bundle } from '../bundle.ts';
import { object, string, digest } from '../json.ts';
import { verifyProvider, verifyPreparedMetadata } from '../release-selection.ts';
import type { Access } from './tailscale.ts';

export type InstalledSelection = { sha256: string; bundle: Bundle };
export type SetupSelection = { version: 3; skillsDirectories: string[]; access: Access; release?: InstalledSelection };
export const parseSetupSelection = (value: unknown): SetupSelection => {
  if (!object(value) || value.version !== 3 || !Array.isArray(value.skillsDirectories) || !value.skillsDirectories.every(string) || !object(value.access) || typeof value.access.enabled !== 'boolean') throw new Error('Unsupported setup selection format. Preserve the selection file and reconcile it explicitly.');
  const access: Access = {enabled: value.access.enabled};
  if (value.access.port !== undefined) {
    if (typeof value.access.port !== 'number' || !Number.isInteger(value.access.port) || value.access.port < 1 || value.access.port > 65535) throw new Error('Invalid saved Tailscale port.');
    access.port = value.access.port;
  }
  for (const key of ['host', 'target'] as const) {
    if (value.access[key] !== undefined) {
      if (!string(value.access[key])) throw new Error('Invalid saved Tailscale mapping.');
      access[key] = value.access[key];
    }
  }
  let release: InstalledSelection | undefined;
  if (value.release !== undefined) {
    if (!object(value.release) || !string(value.release.sha256) || !digest(value.release.sha256)) throw new Error('Invalid installed release selection.');
    release = {sha256: value.release.sha256, bundle: parseBundle(value.release.bundle)};
  }
  return {version: 3, skillsDirectories: value.skillsDirectories, access, ...(release ? {release} : {})};
};

/** Skill references and runtime CLI code must match; source-only setup and docs may evolve. */
export const verifyCheckoutCompatibility = (checkout: string, bundle: Bundle) => {
  for (const root of ['skills/surface', 'apps/cli/src']) {
    const relevant = (path: string) => !path.endsWith('.test.ts') && !path.startsWith('installation/setup/');
    const expected = Object.fromEntries(Object.entries(bundle.files).filter(([path]) => path.startsWith(root + '/') && relevant(path.slice(root.length + 1))).map(([path, hash]) => [path.slice(root.length + 1), hash]));
    const actual = Object.fromEntries(Object.entries(inventory(join(checkout, root))).filter(([path]) => relevant(path)));
    if (!Object.keys(expected).length || !sameInventory(expected, actual)) throw new Error(`Linked checkout ${root} differs from the selected release. Use its compatible checkout before setup; documentation-only changes outside this contract are allowed.`);
  }
};

export const installedBundle = (home: string): {directory: string; bundle: Bundle} | undefined => {
  const path = join(home, 'active.json');
  if (!existsSync(path)) return undefined;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!object(value) || !string(value.release) || !/^[a-f0-9]{40}-surface$/.test(value.release)) throw new Error('Invalid selected installation identity.');
  const directory = join(home, 'releases', value.release), bundle = verifyBundle(directory, false);
  if (value.commit !== bundle.commit || value.release !== bundle.commit + '-surface') throw new Error('Installed release identity mismatch.');
  verifyProvider(directory);
  verifyPreparedMetadata(directory, bundle);
  return {directory, bundle};
};

export const requireSelectedBundle = (actual: Bundle, selected: Bundle) => {
  if (!sameBundle(actual, selected)) throw new Error('Installed release differs from the selected artifact. Run setup with an explicit --release selection.');
};
