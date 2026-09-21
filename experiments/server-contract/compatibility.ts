import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const preferencesFile = 'experimental-preferences.json';
export const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
export function preferences(bytes: string) {
  const value = JSON.parse(bytes);
  if (value?.version === 1 && Object.keys(value).sort().join(',') === 'version,workspaceLabel' && typeof value.workspaceLabel === 'string') return { version: 1, label: value.workspaceLabel as string };
  if (value?.version === 2 && Object.keys(value).sort().join(',') === 'version,workspace' && value.workspace && Object.keys(value.workspace).join(',') === 'label' && typeof value.workspace.label === 'string') return { version: 2, label: value.workspace.label as string };
  throw new Error('Unknown or invalid experimental preferences schema.');
}
export function supported(directory: string) {
  const value = read(join(directory, 'experiments/server-contract/compatibility.json'));
  if (value?.version !== 1 || !Array.isArray(value.preferencesReadVersions) || !value.preferencesReadVersions.length || value.preferencesReadVersions.some((v: unknown) => v !== 1 && v !== 2)) throw new Error('Invalid release compatibility declaration.');
  return value.preferencesReadVersions as number[];
}
export async function validateRelease(directory: string, stateDir: string) {
  const versions = supported(directory), path = join(stateDir, preferencesFile);
  const version = existsSync(path) ? preferences(readFileSync(path, 'utf8')).version : 1;
  if (!versions.includes(version)) throw new Error(`Release cannot read preferences schema ${version}; explicit compatible restore is required before rollback.`);
}
function atomic(path: string, bytes: string, beforeReplace?: () => void) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { writeFileSync(temporary, bytes, { mode: 0o600, flag: 'wx' }); beforeReplace?.(); renameSync(temporary, path); }
  finally { rmSync(temporary, { force: true }); }
}
export async function initializePreferences(directory: string, stateDir: string) {
  await validateRelease(directory, stateDir);
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, preferencesFile);
  if (!existsSync(path)) writeFileSync(path, JSON.stringify({ version: 1, workspaceLabel: 'Local workspace' }) + '\n', { mode: 0o600, flag: 'wx' });
}
/** Caller owns the lifecycle management lock and has established the host is stopped. */
export async function migrate(stateDir: string, directory: string, beforeReplace?: () => void) {
  if (!supported(directory).includes(2)) throw new Error('Selected release does not support preferences schema 2.');
  const path = join(stateDir, preferencesFile), before = readFileSync(path, 'utf8'), value = preferences(before);
  if (value.version !== 1) throw new Error('Migration requires schema 1.');
  const after = JSON.stringify({ version: 2, workspace: { label: value.label } }, null, 2) + '\n';
  const id = randomUUID(), backup = join(stateDir, 'preference-backups', id);
  mkdirSync(backup, { recursive: true, mode: 0o700 });
  writeFileSync(join(backup, 'before.json'), before, { mode: 0o600, flag: 'wx' });
  writeFileSync(join(backup, 'receipt.json'), JSON.stringify({ version: 1, from: 1, to: 2, before: hash(before), after: hash(after) }), { mode: 0o600, flag: 'wx' });
  atomic(path, after, beforeReplace);
  return { status: 'migrated', id, from: 1, to: 2, backup };
}
export async function restore(stateDir: string, directory: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid backup identity.');
  const backup = join(stateDir, 'preference-backups', id), receipt = read(join(backup, 'receipt.json'));
  const before = readFileSync(join(backup, 'before.json'), 'utf8'), path = join(stateDir, preferencesFile);
  if (receipt.version !== 1 || receipt.from !== 1 || receipt.to !== 2 || hash(before) !== receipt.before || preferences(before).version !== 1) throw new Error('Backup provenance mismatch.');
  if (hash(readFileSync(path, 'utf8')) !== receipt.after) throw new Error('Preferences changed after migration; refusing to discard newer data.');
  if (!supported(directory).includes(1)) throw new Error('Selected release cannot read restored schema.');
  atomic(path, before);
  return { status: 'restored', id, version: 1 };
}
