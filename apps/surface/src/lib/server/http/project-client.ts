import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type ProjectOperationInput, type ProjectOutcome } from '../../contracts/projects.ts';
export { projectOperations, type ProjectOperation } from '../../contracts/projects.ts';
export type ProjectCommand = ProjectOperationInput;
export type ManagementOutcome = Omit<ProjectOutcome, 'status'> & {
  status: ProjectOutcome['status'] | 'unknown' | 'unavailable' | 'invalid_connection';
  httpStatus?: number;
};
const failure = (status: ManagementOutcome['status'], code: string, message: string): ManagementOutcome => ({ version: 1, ok: false, status, error: { code, message } });

/** One request to the existing local host. Never starts a host or retries a mutation. */
export const projectOperation = async (stateDir: string, command: ProjectCommand): Promise<ManagementOutcome> => {
  let connection: unknown;
  try { connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8')); }
  catch { return failure('unavailable', 'connection_unavailable', 'Cannot read the Surface connection. Start the server with this state directory.'); }
  let origin: URL;
  let token: string;
  try {
    const value = connection as { origin?: unknown; token?: unknown };
    if (!value || typeof value.origin !== 'string' || typeof value.token !== 'string' || !value.token || /[\r\n]/.test(value.token)) throw new Error();
    origin = new URL(value.origin);
    if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.username || origin.password || origin.href !== origin.origin + '/') throw new Error();
    token = value.token;
  } catch { return failure('invalid_connection', 'invalid_connection', 'Expected a root HTTP origin on 127.0.0.1 and a management token.'); }
  try {
    const response = await fetch(new URL('/api/v1/projects/operations', origin), {
      method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(120_000),
    });
    const data: unknown = await response.json();
    if (!isOutcome(data) || (!response.ok && data.ok)) throw new Error('Invalid management response.');
    return { version: 1, ok: data.ok, status: data.status, ...(data.data === undefined ? {} : { data: data.data }), ...(data.error === undefined ? {} : { error: data.error }), httpStatus: response.status };
  } catch {
    return command.operation === 'list'
      ? failure('unavailable', 'server_unavailable', 'Server could not be reached or returned an invalid response.')
      : failure('unknown', 'outcome_unknown', 'Operation outcome is unknown. Inspect existing state before retrying; the client did not retry.');
  }
}
const isOutcome = (value: unknown): value is ManagementOutcome => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const outcome = value as ManagementOutcome;
  if (outcome.version !== 1 || typeof outcome.ok !== 'boolean') return false;
  if (outcome.ok) return outcome.status === 'ok' && outcome.error === undefined;
  return (outcome.status === 'rejected' || outcome.status === 'failed') && !!outcome.error && typeof outcome.error.code === 'string' && typeof outcome.error.message === 'string';
}
