import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const evidence = resolve('.decompozr/surface/interrupted-delivery', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(evidence, { recursive: true });
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const cases = ['before-acceptance', 'accepted-no-ack', 'completed-no-ack'] as const;
const observations: Record<string, unknown>[] = [];
async function until(predicate: () => boolean, label: string) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await Bun.sleep(25);
  }
}
async function command(args: string[]) {
  const child = Bun.spawn([process.execPath, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  assert.equal(code, 0, stderr);
  return JSON.parse(stdout);
}
for (const scenario of cases) {
  const root = realpathSync(mkdtempSync('/tmp/surface-cut-'));
  const projectRoot = join(root, 'project'), stateDir = join(root, 'state');
  mkdirSync(join(projectRoot, 'routes'), { recursive: true });
  writeFileSync(join(root, 'fixture.json'), JSON.stringify({ kind: 'surface-interrupted-delivery' }));
  writeFileSync(join(projectRoot, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(projectRoot, 'artifact.json'), JSON.stringify({ framework: 'svelte', components: 'routes', routes: 'routes' }));
  writeFileSync(join(projectRoot, 'routes/+page.svelte'), '<h1>Disposable interruption fixture</h1>');
  const threadId = 'fixture-thread-' + crypto.randomUUID(), turnId = 'fixture-active-turn';
  const socket = join(root, 'provider.sock');
  let mutations = 0, checkpointReached = false;
  const providerErrors: string[] = [];
  const provider = Bun.serve({ unix: socket,
    fetch(request, server) { if (server.upgrade(request)) return; return new Response('WebSocket required', { status: 426 }); },
    websocket: { message(ws, raw) {
      try {
        const message = JSON.parse(String(raw));
        if (message.id === undefined) return;
        let result: unknown;
        switch (message.method) {
          case 'initialize': result = {}; break;
          case 'thread/read':
            assert.equal(message.params.threadId, threadId);
            result = { thread: { id: threadId, cwd: projectRoot, status: { type: 'active' } } }; break;
          case 'thread/turns/list': result = { data: [{ id: turnId, status: 'inProgress' }] }; break;
          case 'thread/queue/add': {
            mutations++;
            assert.equal(message.params.threadId, threadId);
            const input = JSON.parse(message.params.input[0].text.split('\n')[1]);
            assert.equal(message.params.clientUserMessageId, input.responseId);
            const identity = { requestId: input.requestId, responseId: input.responseId, threadId, payloadHash: hash(JSON.stringify(input.data)) };
            const event = (entry: unknown) => appendFileSync(join(root, 'provider.jsonl'), JSON.stringify(entry) + '\n');
            if (scenario !== 'before-acceptance') event({ ...identity, stage: 'accepted', queuedSubmissionId: 'fixture-queue-' + input.responseId });
            if (scenario === 'completed-no-ack') {
              const output = JSON.stringify({ requestId: input.requestId, responseId: input.responseId, data: input.data }) + '\n';
              writeFileSync(join(projectRoot, 'applied.json'), output);
              event({ ...identity, stage: 'completed', outputHash: hash(output) });
            }
            checkpointReached = true;
            // Deliberately withhold the acknowledgement. Parent kills its own
            // host handle only after the external journal/output is written.
            return;
          }
          default: throw new Error(`Unexpected provider call ${message.method}`);
        }
        ws.send(JSON.stringify({ id: message.id, result }));
      } catch (error) { providerErrors.push(String(error)); }
    } },
  });
  let host: ReturnType<typeof Bun.spawn> | undefined;
  const pids: number[] = [];
  let connection: { origin: string; token: string; pid: number };
  async function launch() {
    const log = openSync(join(evidence, `${scenario}-host-${pids.length}.log`), 'a');
    try { host = Bun.spawn([process.execPath, join(import.meta.dir, 'host.ts'), root], { stdout: log, stderr: log }); }
    finally { closeSync(log); }
    pids.push(host.pid);
    await until(() => {
      if (host!.exitCode !== null) throw new Error('Fixture host exited before ready');
      if (!existsSync(join(stateDir, 'connection.json'))) return false;
      connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
      return connection.pid === host!.pid && existsSync(join(root, 'ready.json'))
        && JSON.parse(readFileSync(join(root, 'ready.json'), 'utf8')).pid === host!.pid;
    }, 'owned fixture host ready');
  }
  async function api(path: string, body?: unknown, expected = 200) {
    const response = await fetch(connection.origin + path, {
      method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value;
  }
  try {
    await launch();
    await api('/api/namespaces', { name: 'recovery' }, 201);
    await api('/api/mounts', { namespace: 'recovery', name: 'page', source: projectRoot, projectRoot });
    const binding = await api('/api/bindings', { projectRoot, threadId, socketPath: socket }, 201);
    const request = await api('/api/requests', { bindingId: binding.id, namespace: 'recovery', name: 'page', component: 'routes/+page.svelte', recipientSelection: true,
      title: 'Interrupted fixture only', schema: { type: 'object', additionalProperties: false, required: ['label'], properties: { label: { type: 'string' } } } }, 201);
    const submission = { responseId: crypto.randomUUID(), data: { label: scenario }, delivery: { mode: 'queue', expectedStatus: 'active', expectedTurnId: turnId } };
    writeFileSync(join(root, 'checkpoint.json'), JSON.stringify({ requestId: request.id, threadId, projectRoot, submission }));
    const inFlight = api(`/api/requests/${request.id}/responses`, submission).then(() => 'acknowledged', () => 'transport-ended');
    await until(() => checkpointReached || providerErrors.length > 0, 'provider cut point');
    assert.deepEqual(providerErrors, []);
    const before = JSON.parse(readFileSync(join(stateDir, 'interactions.json'), 'utf8'));
    assert.equal(before.requests[0].response.status, 'delivering');
    const oldHost = host!;
    assert.equal(Number(readFileSync(join(stateDir, 'server.lock'), 'utf8')), oldHost.pid);
    oldHost.kill('SIGKILL'); await oldHost.exited; host = undefined;
    assert.equal(await inFlight, 'transport-ended');
    // Deliberate harness reconciliation, never saved-PID-only authority:
    // the exact owned handle exited, and the lock still names that handle.
    assert.equal(Number(readFileSync(join(stateDir, 'server.lock'), 'utf8')), oldHost.pid);
    assert.throws(() => process.kill(oldHost.pid, 0), (error: any) => error.code === 'ESRCH');
    unlinkSync(join(stateDir, 'server.lock')); unlinkSync(join(stateDir, 'connection.json'));
    await launch();
    const recovered = await api(`/api/requests/${request.id}`);
    assert.equal(recovered.response.status, 'unknown');
    assert.deepEqual(recovered.response.data, submission.data);
    assert.equal(recovered.response.id, submission.responseId);
    assert.equal(recovered.response.receipt, undefined);
    assert.equal(recovered.result, undefined);
    assert.equal(mutations, 1, 'Restart must not replay');
    assert.equal((await api(`/api/requests/${request.id}/responses`, submission)).response.status, 'unknown');
    await api(`/api/requests/${request.id}/responses`, { ...submission, responseId: crypto.randomUUID() }, 409);
    await api(`/api/requests/${request.id}/takeover`, { threadId }, 409);
    assert.equal(mutations, 1, 'Duplicate/changed-ID/takeover attempts must not replay');
    const reconciled = await command([join(import.meta.dir, 'reconcile.ts'), root]);
    assert.equal(reconciled.replayAllowed, false);
    assert.equal(reconciled.disposition, scenario === 'before-acceptance' ? 'unresolved-no-provider-evidence' : scenario === 'accepted-no-ack' ? 'unresolved-accepted-without-completion' : 'completed-with-matching-output');
    if (reconciled.resultPublicationSupported) {
      await command([join(import.meta.dir, '../../apps/cli/src/runtime.ts'), 'result', '--state-dir', stateDir, '--request', request.id,
        '--data', JSON.stringify({ message: 'Fixture output reconciled after interruption', responseId: submission.responseId, outputHash: hash(readFileSync(join(projectRoot, 'applied.json'))) })]);
    }
    const final = await api(`/api/requests/${request.id}`);
    assert.equal(Boolean(final.result), scenario === 'completed-no-ack');
    assert.equal(final.response.status, 'unknown', 'Retain historical lost acknowledgement even after result publication');
    assert.equal((await api('/api/requests')).length, 1);
    assert.equal(mutations, 1);
    assert.deepEqual(providerErrors, []);
    observations.push({ scenario, requestId: request.id, responseId: submission.responseId, hostPids: [...pids], killedAtStatus: 'delivering', recoveredStatus: final.response.status,
      providerMutationCalls: mutations, reconciliation: reconciled, resultPublished: Boolean(final.result), fixtureOnly: true, lockRecovery: 'explicit owned-process harness intervention' });
    writeFileSync(join(evidence, `${scenario}.json`), JSON.stringify(observations.at(-1), null, 2));
    console.log(`PASS ${scenario}: ${reconciled.disposition}; provider mutation calls=${mutations}; result=${Boolean(final.result)}`);
  } finally {
    if (host && host.exitCode === null) {
      const child = host;
      child.kill('SIGTERM');
      const graceful = await Promise.race([child.exited.then(() => true), Bun.sleep(3000).then(() => false)]);
      if (!graceful) { child.kill('SIGKILL'); await child.exited; }
    }
    provider.stop(true);
    for (const pid of pids) assert.throws(() => process.kill(pid, 0), (error: any) => error.code === 'ESRCH');
    rmSync(root, { recursive: true, force: true });
  }
}
writeFileSync(join(evidence, 'summary.json'), JSON.stringify({ checkedAt: new Date().toISOString(), bun: Bun.version, observations,
  limits: ['fixture provider only', 'fresh process, not a fresh agent session', 'explicit harness lock recovery', 'no power-loss/fsync guarantee', 'no exactly-once execution guarantee', 'no browser/SSE claim'],
}, null, 2));
console.log(`Evidence: ${evidence}`);
