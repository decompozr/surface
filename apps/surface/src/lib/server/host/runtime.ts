import { startPageRuntime } from '../page-runtime/server.ts';
import { createInteractions } from '../interactions/index.ts';
import { createProjectRoutes } from '../http/project-routes.ts';
import { presentation } from './presentation.ts';
import type { AgentAdapter } from '../agent-adapters/codex.ts';
import type { ProjectIdentityResolver } from '../../contracts/projects.ts';
export type { MountResource, MountResourceContext } from '../page-runtime/server.ts';
export function startSingleton(options: Omit<Parameters<typeof startPageRuntime>[0], 'integration'> & { adapter?: AgentAdapter; projectIdentity?: ProjectIdentityResolver }) {
  return startPageRuntime({ ...options, integration: {
    presentation,
    interactions: input => createInteractions({ ...input, adapter: options.adapter }),
    projects: input => createProjectRoutes({ ...input, identity: options.projectIdentity }),
  } });
}
