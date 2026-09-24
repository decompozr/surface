import { createProjectService } from '../services/projects.ts';
import type { ProjectOutcome, ProjectOperationInput } from '../../contracts/projects.ts';
import { InputError } from '../services/service.ts';

type Options = Parameters<typeof createProjectService>[0] & {
  /** One host-owned queue shared with direct mount/unmount operations. */
  schedule<T>(operation: () => Promise<T>): Promise<T>;
};
type Request = {
  pathname: string;
  method?: string;
  authorized: boolean;
  readBody(): Promise<unknown>;
  json(outcome: ProjectOutcome, status: number): void;
};

/** HTTP adaptation only. Project validation, identity and persistence belong to the core. */
export const createProjectRoutes = (options: Options) => {
  const service = createProjectService({ stateDir: options.stateDir, runtime: options.runtime, identity: options.identity });
  const execute = (input: ProjectOperationInput) => options.schedule(() => service.execute(input));
  const route = async (request: Request): Promise<boolean> => {
    if (request.pathname !== '/api/v1/projects/operations') return false;
    const reject = (httpStatus: number, code: string, message: string) => request.json({
      version: 1, ok: false, status: 'rejected', error: { code, message },
    }, httpStatus);
    // Authorization precedes body parsing and every project-specific filesystem operation.
    if (!request.authorized) { reject(401, 'unauthorized', 'Management authorization required.'); return true; }
    if (request.method !== 'POST') { reject(405, 'method_not_allowed', 'Use POST for project operations.'); return true; }
    try {
      const input = await request.readBody();
      // The core validates the untrusted payload. Queue admission happens after the complete body,
      // so a body that finishes during shutdown cannot create a manifest or mutate the registry.
      const outcome = await execute(input as ProjectOperationInput);
      request.json(outcome, outcome.status === 'ok' ? 200 : outcome.status === 'rejected' ? 400 : 500);
    } catch (error) {
      if (error instanceof InputError) reject(error.status, error.status === 409 ? 'server_closing' : 'invalid_request', error.message);
      else request.json({ version: 1, ok: false, status: 'failed', error: { code: 'internal_error', message: error instanceof Error ? error.message : 'Project operation failed.' } }, 500);
    }
    return true;
  };
  return Object.assign(route, { execute });
};
