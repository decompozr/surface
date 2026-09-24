import { join } from 'node:path';
import { startKitFoundation } from '../sveltekit/server.ts';
import { initializePreferences } from './compatibility.ts';
import { backendRuntime } from '@decompozr/surface-app/server/http/backends';
export { backendRuntime, declaration } from '@decompozr/surface-app/server/http/backends';

export async function startContractHost(options: Parameters<typeof startKitFoundation>[0]) {
  await initializePreferences(join(import.meta.dir, '../..'), options.stateDir);
  return startKitFoundation({ ...options, ...backendRuntime(options.stateDir) });
}
