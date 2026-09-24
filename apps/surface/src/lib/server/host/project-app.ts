import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectOperation } from '@decompozr/surface-client/management';
import type { ProjectManifest, ProjectMount } from '@decompozr/surface-contracts/projects';
import { startSurfaceApp } from './host.ts';

/** Development entry point: register this checkout and mount its versioned examples. */
export async function startProjectApp(options: Parameters<typeof startSurfaceApp>[0] & { projectRoot: string }) {
  const manifest = JSON.parse(readFileSync(join(options.projectRoot, 'artifact.project.json'), 'utf8')) as ProjectManifest;
  const example = manifest.artifacts.filter(item => item.source === 'examples' && !item.archived);
  if (example.length !== 1) throw new Error('Expected one active project artifact with source examples.');
  const app = await startSurfaceApp(options);
  try {
    for (const operation of ['register', 'mount'] as const) {
      const outcome = await projectOperation(options.stateDir, {
        operation, projectRoot: options.projectRoot,
        ...(operation === 'mount' ? { artifactId: example[0]!.id } : {}),
      });
      if (!outcome.ok) throw new Error(`Default examples ${operation}: ${outcome.error?.message ?? outcome.status}`);
      if (operation === 'mount') return { ...app, previewUrl: (outcome.data as ProjectMount).previewUrl! };
    }
    throw new Error('Examples did not mount.');
  } catch (error) { await app.stop(); throw error; }
}
