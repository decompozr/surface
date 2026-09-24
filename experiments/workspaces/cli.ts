import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { projectMain } from '@decompozr/surface-cli/projects';
import { workspaceDirectory } from './identity.ts';

export { retire } from '@decompozr/surface-app/server/workspaces/retire';
import { retire } from '@decompozr/surface-app/server/workspaces/retire';
if (import.meta.main) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'state-dir': { type: 'string' }, project: { type: 'string' }, artifact: { type: 'string' }, source: { type: 'string' }, name: { type: 'string' }, workspace: { type: 'string' } } });
    const stateDir = resolve(values['state-dir'] ?? process.env.SURFACE_STATE_DIR ?? (() => { throw new Error('Select the shared service with --state-dir or SURFACE_STATE_DIR.'); })());
    if (positionals[0] === 'retire') { if (!values.workspace) throw new Error('Specify --workspace ID.'); console.log(JSON.stringify(await retire(stateDir, values.workspace), null, 2)); }
    else {
      const args = [positionals[0] ?? 'list', '--project', resolve(values.project ?? process.cwd()), '--state-dir', stateDir];
      for (const field of ['artifact', 'source', 'name'] as const) if (values[field]) args.push('--' + field, values[field]);
      await projectMain(args, stateDir);
    }
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
