import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { projectOperation } from '../src/lib/server/http/project-client.ts';

const temporary = () => { const directory = mkdtempSync(join(tmpdir(), 'surface-access-')); directories.push(directory); return directory; };

const fixture = (handler: (request: Request) => Response | Promise<Response>) => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handler }); servers.push(server); return server;
};

const connect = (state: string, origin: string, token = 'private-management-token') => { writeFileSync(join(state, 'connection.json'), JSON.stringify({ origin, token })); };


const directories: string[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const command = { operation: 'list' as const, projectRoot: '/fixture/project' };

describe('project management transport', () => {
  test('reads the current connection on each call and forwards credentials only to the local host', async () => {
    const state = temporary();
    let calls = 0;
    const server = fixture(async request => {
      calls++;
      expect(request.method).toBe('POST');
      expect(new URL(request.url).pathname).toBe('/api/v1/projects/operations');
      expect(request.headers.get('authorization')).toBe(`Bearer token-${calls}`);
      expect(await request.json()).toEqual(command);
      return Response.json({ version: 1, ok: true, status: 'ok', data: { calls } });
    });
    connect(state, server.url.origin, 'token-1');
    expect((await projectOperation(state, command)).data).toEqual({ calls: 1 });
    connect(state, server.url.origin, 'token-2');
    const outcome = await projectOperation(state, command);
    expect(outcome.data).toEqual({ calls: 2 });
    expect(JSON.stringify(outcome)).not.toContain('token-2');
  });

  test('rejects unsafe connection locations before making a request', async () => {
    const state = temporary(); let calls = 0;
    const server = fixture(() => { calls++; return Response.json({}); });
    for (const origin of ['https://127.0.0.1:4000', 'http://localhost:4000', 'http://example.com', `${server.url.origin}/nested`, `${server.url.origin}/?q=1`, `${server.url.origin}/#fragment`, `http://user@127.0.0.1:${server.port}`]) {
      connect(state, origin);
      expect((await projectOperation(state, command)).status).toBe('invalid_connection');
    }
    expect(calls).toBe(0);
    writeFileSync(join(state, 'connection.json'), 'null');
    expect((await projectOperation(state, command)).status).toBe('invalid_connection');
    rmSync(join(state, 'connection.json'));
    expect((await projectOperation(state, { ...command, operation: 'init' })).status).toBe('unavailable');
  });

  test('preserves structured core failures on non-2xx and successful HTTP responses', async () => {
    const state = temporary();
    const rejected = { version: 1, ok: false, status: 'rejected', error: { code: 'identity_conflict', message: 'Project belongs elsewhere.' } } as const;
    let status = 409;
    const server = fixture(() => Response.json(rejected, { status })); connect(state, server.url.origin);
    expect(await projectOperation(state, command)).toEqual({ ...rejected, httpStatus: 409 });
    status = 200;
    expect(await projectOperation(state, command)).toEqual({ ...rejected, httpStatus: 200 });
  });

  test('does not follow redirects or retry mutations; malformed responses remain ambiguous', async () => {
    const state = temporary(); let targetCalls = 0, calls = 0;
    const target = fixture(() => { targetCalls++; return Response.json({}); });
    const server = fixture(() => { calls++; return Response.redirect(target.url, 307); }); connect(state, server.url.origin);
    expect((await projectOperation(state, { ...command, operation: 'init' })).status).toBe('unknown');
    expect((await projectOperation(state, command)).status).toBe('unavailable');
    expect(calls).toBe(2); expect(targetCalls).toBe(0);
    const invalid = fixture(() => Response.json({ version: 1, ok: true, status: 'failed' })); connect(state, invalid.url.origin);
    expect((await projectOperation(state, { ...command, operation: 'archive', artifactId: crypto.randomUUID() })).status).toBe('unknown');
  });

  test('CLI exits nonzero for failed and ambiguous mutation outcomes', async () => {
    const state = temporary(); let calls = 0;
    const server = fixture(() => {
      calls++;
      return calls === 1
        ? Response.json({ version: 1, ok: false, status: 'failed', error: { code: 'runtime_failed', message: 'Compiler rejected the source.' } })
        : new Response('lost structured response');
    }); connect(state, server.url.origin);
    for (const status of ['failed', 'unknown']) {
      const child = Bun.spawn([process.execPath, resolve(process.cwd(), 'apps/cli/src/index.ts'), 'project', 'mount', '--artifact', crypto.randomUUID(), '--project', '/fixture/project', '--state-dir', state], { stdout: 'pipe', stderr: 'pipe' });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect(code).toBe(1); expect(stderr).toBe(''); expect(JSON.parse(stdout).status).toBe(status);
    }
    expect(calls).toBe(2);
  });

  test('CLI emits the server outcome, sets failure exit code and never changes project files', async () => {

    const cli = async (...args: string[]) => {
      const child = Bun.spawn([process.execPath, resolve(process.cwd(), 'apps/cli/src/index.ts'), 'project', ...args, '--project', projectRoot, '--state-dir', state], { stdout: 'pipe', stderr: 'pipe' });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect(stderr).toBe(''); return { code, outcome: JSON.parse(stdout) };
    };

    const state = temporary(), projectRoot = temporary();
    const marker = join(projectRoot, 'keep.txt'); writeFileSync(marker, 'user source');
    const received: unknown[] = [];
    const server = fixture(async request => {
      const body = await request.json() as { operation: string }; received.push(body);
      return body.operation === 'add'
        ? Response.json({ version: 1, ok: false, status: 'rejected', error: { code: 'invalid_input', message: 'Fixture rejection.' } }, { status: 400 })
        : Response.json({ version: 1, ok: true, status: 'ok', data: { projectRoot } });
    }); connect(state, server.url.origin);
    expect((await cli('list')).code).toBe(0);
    const beforeCommand = Bun.spawn([process.execPath, resolve(process.cwd(), 'apps/cli/src/index.ts'), '--state-dir', state, 'project', 'list', '--project', projectRoot], { stdout: 'pipe', stderr: 'pipe' });
    const [beforeCode, beforeOutput, beforeError] = await Promise.all([beforeCommand.exited, new Response(beforeCommand.stdout).text(), new Response(beforeCommand.stderr).text()]);
    expect(beforeCode).toBe(0); expect(beforeError).toBe(''); expect(JSON.parse(beforeOutput).ok).toBe(true);
    const rejected = await cli('add', '--source', 'artifacts/panel', '--name', 'Panel');
    expect(rejected.code).toBe(1); expect(rejected.outcome.error.code).toBe('invalid_input');
    expect(received).toEqual([{ operation: 'list', projectRoot }, { operation: 'list', projectRoot }, { operation: 'add', projectRoot, source: 'artifacts/panel', name: 'Panel' }]);
    expect(readFileSync(marker, 'utf8')).toBe('user source');
  });
});
