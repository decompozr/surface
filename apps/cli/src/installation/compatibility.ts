import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installationSource } from './release-source.ts';

export const validateRelease = async (directory: string, stateDir: string) => {
  const descriptor = installationSource(directory, 'compatibility.json');
  const value = JSON.parse(readFileSync(descriptor,'utf8'));
  if (value.version !== 1 || !Array.isArray(value.workspaceLedgerVersions) || !Array.isArray(value.interactionVersions) || value.registryVersion !== 'singleton-v1') throw new Error('Invalid Surface compatibility descriptor.');
  for (const [name,versions] of [['workspaces.json',value.workspaceLedgerVersions],['interactions.json',value.interactionVersions]] as const) {
    const path = join(stateDir,name); if (!existsSync(path)) continue;
    const saved = JSON.parse(readFileSync(path,'utf8')); if (!versions.includes(saved.version)) throw new Error(`Release cannot read ${name} schema ${saved.version}. Restore compatible state explicitly before rollback.`);
  }
  if (existsSync(join(stateDir,'state.json'))) throw new Error('Earlier per-runtime service state requires separate reconciliation; it is not a singleton workspace store.');
};
