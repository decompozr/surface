import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export async function validateRelease(directory: string, stateDir: string) {
  const current = join(directory,'apps/installer/src/compatibility.json');
  const previous = join(directory, 'apps/surface/src/installation/compatibility.json');
  const descriptor = existsSync(current) ? current : existsSync(previous) ? previous : join(directory,'src/installation/compatibility.json'); // Pre-consolidation releases.
  if (!existsSync(descriptor)) throw new Error('This release does not declare support for the Surface workspace service.');
  const value = JSON.parse(readFileSync(descriptor,'utf8'));
  if (value.version !== 1 || !Array.isArray(value.workspaceLedgerVersions) || !Array.isArray(value.interactionVersions) || value.registryVersion !== 'singleton-v1') throw new Error('Invalid Surface compatibility descriptor.');
  for (const [name,versions] of [['workspaces.json',value.workspaceLedgerVersions],['interactions.json',value.interactionVersions]] as const) {
    const path = join(stateDir,name); if (!existsSync(path)) continue;
    const saved = JSON.parse(readFileSync(path,'utf8')); if (!versions.includes(saved.version)) throw new Error(`Release cannot read ${name} schema ${saved.version}. Restore compatible state explicitly before rollback.`);
  }
  if (existsSync(join(stateDir,'state.json'))) throw new Error('Earlier per-runtime service state requires separate reconciliation; it is not a singleton workspace store.');
}
