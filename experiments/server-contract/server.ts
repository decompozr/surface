import { join } from 'node:path';
import { startKitFoundation } from '../sveltekit/server.ts';
import { initializePreferences } from './compatibility.ts';
import { backendRuntime } from '../../src/server/backends.ts';
export { backendRuntime, declaration } from '../../src/server/backends.ts';

export async function startContractHost(options: Parameters<typeof startKitFoundation>[0]) {
  await initializePreferences(join(import.meta.dir, '../..'), options.stateDir);
  return startKitFoundation({ ...options, ...backendRuntime(options.stateDir) });
}
