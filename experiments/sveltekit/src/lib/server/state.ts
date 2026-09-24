import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Kit sees a sanitized view, never source roots or management/session capabilities. */
export const status = (stateDir: string) => {
  let mounts: Mount[] = [];
  try { mounts = JSON.parse(readFileSync(join(stateDir, 'registry.json'), 'utf8')).mounts; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return { foundation: 'sveltekit', pid: process.pid, mounts: mounts.map(({ namespace, name, status, components }) => ({ namespace, name, status, components })) };
};


type Mount = { namespace: string; name: string; status: string; components: string[] };
