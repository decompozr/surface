import { readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { projectOperation } from '../../src/client/management.ts';

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const absolutePath = z.string().min(1).refine(isAbsolute, 'Expected an absolute path.');
const id = z.uuid();
const jsonObject = z.record(z.string(), z.unknown());
const outputSchema = z.object({
  ok: z.boolean(), status: z.string(), data: z.unknown().optional(),
  error: z.string().optional(), httpStatus: z.number().optional(),
});
type Outcome = z.infer<typeof outputSchema>;

/** Transport adapter only. State, validation, delivery and lifecycle belong to the existing singleton. */
export function createMcpServer(stateDir: string) {
  const server = new McpServer({ name: 'surface-singleton-experiment', version: '0.1.0' });
  async function api(path: string, body?: unknown): Promise<Outcome> {
    let origin: URL, token: string;
    try {
      const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
      origin = new URL(connection.origin);
      if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.username || origin.password || origin.href !== origin.origin + '/' || typeof connection.token !== 'string' || !connection.token) {
        return { ok: false, status: 'invalid_connection', error: 'Expected a local singleton connection file with a management token.' };
      }
      token = connection.token;
    } catch {
      return { ok: false, status: 'unavailable', error: 'Cannot read the singleton connection. Start the singleton with this state directory.' };
    }
    try {
      const response = await fetch(new URL(path, origin), {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120_000),
      });
      const data = await response.json() as any;
      if (!response.ok) return { ok: false, status: 'rejected', httpStatus: response.status, error: typeof data?.error === 'string' ? data.error : 'Singleton rejected the operation.' };
      // The preview URL is the intentional browser capability. Never duplicate the raw request token.
      if (data && typeof data === 'object' && !Array.isArray(data)) delete data.token;
      const delivery = path.endsWith('/responses') ? data?.response?.status : undefined;
      const status = delivery ?? data?.status ?? (data?.closed === true ? 'closed' : 'ok');
      const failed = status === 'failed' || status === 'unknown';
      return { ok: !failed, status, httpStatus: response.status, data };
    } catch {
      // A mutation may have reached the server even if its response was lost. Never retry here.
      return { ok: false, status: body === undefined ? 'unavailable' : 'unknown', error: body === undefined ? 'Singleton could not be reached or returned an invalid response.' : 'Operation outcome is unknown. Inspect existing state before retrying; the adapter did not retry.' };
    }
  }
  function register<S extends z.ZodRawShape>(name: string, description: string, shape: S,
    operation: (input: z.infer<z.ZodObject<S>>) => Promise<Outcome>, readOnly = false) {
    server.registerTool(name, {
      description, inputSchema: z.strictObject(shape), outputSchema,
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: !readOnly },
    }, async input => {
      const outcome = await operation(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(outcome) }], structuredContent: outcome, isError: !outcome.ok };
    });
  }
  register('surface_health', 'Read singleton health. Does not start a server.', {}, () => api('/api/health'), true);
  register('surface_namespace', 'Create a namespace in the existing singleton.', { name: slug }, input => api('/api/namespaces', input));
  register('surface_mount', 'Mount a source folder and prepare declared dependencies. Failed preparation is an error outcome even when the HTTP request succeeded.', {
    namespace: slug, name: slug, source: absolutePath, projectRoot: absolutePath.optional(),
  }, input => api('/api/mounts', input));
  register('surface_list', 'List mounts or interaction records; does not return request capabilities.', {
    kind: z.enum(['mounts', 'requests']).default('mounts'),
  }, input => api(input.kind === 'mounts' ? '/api/mounts' : '/api/requests'), true);
  register('surface_unmount', 'Revoke a mount while preserving its source and saved interactions.', { namespace: slug, name: slug }, input => api('/api/unmount', input));
  register('surface_bind', 'Bind the exact existing agent conversation to its canonical project. Does not create a conversation.', {
    projectRoot: absolutePath, threadId: z.string().min(1).max(100), socketPath: absolutePath,
  }, input => api('/api/bindings', input));
  register('surface_request', 'Create an interaction for a mounted component. Returns a private preview URL containing the browser request capability; share only with the intended user.', {
    bindingId: id, title: z.string().trim().min(1).max(200), namespace: slug, name: slug,
    component: z.string().min(1).max(1000), schema: jsonObject.optional(),
  }, input => api('/api/requests', input));
  register('surface_inspect', 'Read saved interaction state without its capability. Accepted delivery is not agent completion.', { requestId: id }, input => api(`/api/requests/${input.requestId}`), true);
  register('surface_send', 'Submit data once to an existing interaction and its exact agent session. Retain responseId for reconciliation; never retry an unknown outcome with a new ID.', {
    requestId: id, responseId: z.string().min(1).max(100), data: jsonObject,
  }, ({ requestId, ...data }) => api(`/api/requests/${requestId}/responses`, data));
  register('surface_result', 'Publish result JSON for a submitted interaction. This is result publication, not proof of agent authorship.', { requestId: id, data: jsonObject }, input => api(`/api/requests/${input.requestId}/result`, input.data));
  register('surface_close', 'Close an interaction to new submissions; does not cancel an already delivered agent turn.', { requestId: id }, input => api(`/api/requests/${input.requestId}/close`, {}));
  const projectOutputSchema = z.object({
    version: z.literal(1), ok: z.boolean(), status: z.enum(['ok', 'rejected', 'failed', 'unknown', 'unavailable', 'invalid_connection']),
    data: z.unknown().optional(), error: z.object({ code: z.string(), message: z.string() }).optional(), httpStatus: z.number().optional(),
  });
  const projectShapes = {
    init: { projectRoot: absolutePath, name: z.string().min(1).optional() },
    add: { projectRoot: absolutePath, source: z.string().min(1), name: z.string().min(1) },
    list: { projectRoot: absolutePath }, register: { projectRoot: absolutePath },
    mount: { projectRoot: absolutePath, artifactId: id }, unmount: { projectRoot: absolutePath, artifactId: id },
    archive: { projectRoot: absolutePath, artifactId: id }, restore: { projectRoot: absolutePath, artifactId: id },
  };
  const projectDescriptions = {
    init: 'Create a project-owned manifest with a stable identity. Refuses to overwrite an existing manifest.',
    add: 'Register an existing project-relative source folder under a display name and a stable artifact ID.',
    list: 'Read project definitions, source availability and observed runtime state separately.',
    register: 'Bind the stable project identity to its canonical root in this server.',
    mount: 'Mount the selected active artifact and prepare its declared dependencies.',
    unmount: 'Make the selected preview unavailable while retaining source, definitions and interactions.',
    archive: 'Unmount the selected artifact and mark its definition archived; retain source and dependencies.',
    restore: 'Unarchive a definition. Leaves runtime state unchanged; mount explicitly when needed.',
  };
  for (const operation of Object.keys(projectShapes) as (keyof typeof projectShapes)[]) {
    server.registerTool(`surface_project_${operation}`, {
      description: `${projectDescriptions[operation]} Uses the existing Surface server; does not start one. An unknown outcome must be inspected before retrying.`,
      inputSchema: z.strictObject(projectShapes[operation]), outputSchema: projectOutputSchema,
      annotations: { readOnlyHint: operation === 'list', destructiveHint: operation !== 'list', openWorldHint: operation !== 'list' },
    }, async input => {
      const outcome = await projectOperation(stateDir, { ...input, operation });
      return { content: [{ type: 'text' as const, text: JSON.stringify(outcome) }], structuredContent: outcome, isError: !outcome.ok };
    });
  }
  return server;
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { 'state-dir': { type: 'string' } } });
  const stateDir = resolve(values['state-dir'] ?? join(import.meta.dir, '../../.decompozr/surface/singleton'));
  void serveStdio(() => createMcpServer(stateDir));
}
