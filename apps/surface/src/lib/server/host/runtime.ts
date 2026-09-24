import { startPageRuntime } from '@decompozr/surface-page-runtime/server';
import { createInteractions } from './interactions.ts';
import { createProjectRoutes } from '../http/project-routes.ts';
import { presentation } from './presentation.ts';
import type { AgentAdapter } from '@decompozr/surface-agent-adapters/codex';
import type { ProjectIdentityResolver } from '@decompozr/surface-contracts/projects';
export type { MountResource, MountResourceContext } from '@decompozr/surface-page-runtime/server';
export function startSingleton(options: Omit<Parameters<typeof startPageRuntime>[0], 'integration'> & { adapter?: AgentAdapter; projectIdentity?: ProjectIdentityResolver }) {
  return startPageRuntime({ ...options, integration: {
    presentation,
    interactions: input => createInteractions({ ...input, adapter: options.adapter }),
    projects: input => createProjectRoutes({ ...input, identity: options.projectIdentity }),
  } });
}
