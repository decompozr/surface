#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { startServer } from '../server/index.ts';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const cliPath = fileURLToPath(import.meta.url);

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    project: { type: 'string' }, thread: { type: 'string' }, socket: { type: 'string' },
    binding: { type: 'string' }, title: { type: 'string' }, request: { type: 'string' },
    data: { type: 'string' }, 'response-id': { type: 'string' }, port: { type: 'string' },
    'ui-port': { type: 'string' }, 'state-dir': { type: 'string' }, dev: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  const command = positionals[0];
  if (values.help || !command) {
    console.log(`Artifact prototype (Bun + TypeScript)

  serve [--dev] [--port 4317] [--ui-port 5173]
  bind --project /path --thread UUID --socket /path/to/control.sock
  request --binding ID --title "Choose a design"
  list
  inspect --request ID
  send --request ID --response-id ID --data '{"option":"B","width":120,"comment":""}'
  result --request ID --data '{"message":"Updated","option":"B","width":120}'
  close --request ID

All commands accept --state-dir PATH (default: this checkout's .artifact).
serve runs in the foreground; Ctrl+C stops its own processes. --dev starts the Svelte Vite example.
Live bind/send commands target the exact registered Codex conversation. No mock agent runs in production.`);
    return;
  }
  const stateDir = resolve(values['state-dir'] ?? join(root, '.artifact'));
  const required = (key: keyof typeof values) => {
    const value = values[key];
    if (typeof value !== 'string' || !value) throw new Error(`Missing --${key}.`);
    return value;
  };
  if (command === 'serve') {
    const port = Number(values.port ?? 4317), uiPort = Number(values['ui-port'] ?? 5173);
    for (const number of [port, uiPort]) if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error('Invalid port.');
    const app = startServer({
      stateDir, cliPath, uiDir: join(root, 'examples/svelte-feedback/dist'), port,
      uiOrigin: values.dev ? `http://127.0.0.1:${uiPort}` : undefined,
    });
    let child: ReturnType<typeof Bun.spawn> | undefined;
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      child?.kill();
      app.stop();
    };
    process.once('SIGINT', () => { stop(); process.exit(0); });
    process.once('SIGTERM', () => { stop(); process.exit(0); });
    if (values.dev) {
      try { child = Bun.spawn([process.execPath, join(root, 'examples/svelte-feedback/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'], {
        cwd: join(root, 'examples/svelte-feedback'),
        env: { ...process.env, ARTIFACT_API_ORIGIN: app.origin },
        stdout: 'inherit', stderr: 'inherit',
      }); } catch (error) { stop(); throw error; }
      void child.exited.then(code => { if (!stopping) { console.error(`Preview process exited (${code}).`); stop(); process.exit(code || 1); } });
    }
    if (values.dev) {
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          const response = await fetch(`http://127.0.0.1:${uiPort}/`, { signal: AbortSignal.timeout(500) });
          if (response.ok && (await response.text()).includes('/src/main.ts')) { ready = true; break; }
        } catch { /* preview is still starting */ }
        await Bun.sleep(100);
      }
      if (!ready) { stop(); throw new Error('The Svelte preview did not become ready.'); }
    }
    console.log(JSON.stringify({ status: 'ready', api: app.origin, preview: values.dev ? `http://127.0.0.1:${uiPort}` : app.origin }));
    return;
  }
  const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  const base = new URL(connection.origin);
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1') throw new Error('Expected a local Artifact connection.');
  async function api(path: string, data?: unknown) {
    const response = await fetch(new URL(path, base), {
      method: data === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(90_000),
    });
    const body = await response.json() as { error?: string; response?: { status: string } };
    if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
    if (body.response?.status === 'failed' || body.response?.status === 'unknown') process.exitCode = 1;
  }
  switch (command) {
    case 'bind': await api('/api/bindings', { projectRoot: resolve(required('project')), threadId: required('thread'), socketPath: resolve(required('socket')) }); break;
    case 'request': await api('/api/requests', { bindingId: required('binding'), title: required('title') }); break;
    case 'list': await api('/api/requests'); break;
    case 'inspect': await api(`/api/requests/${encodeURIComponent(required('request'))}`); break;
    case 'send': await api(`/api/requests/${encodeURIComponent(required('request'))}/responses`, { responseId: required('response-id'), data: JSON.parse(required('data')) }); break;
    case 'result': await api(`/api/requests/${encodeURIComponent(required('request'))}/result`, JSON.parse(required('data'))); break;
    case 'close': await api(`/api/requests/${encodeURIComponent(required('request'))}/close`, {}); break;
    default: throw new Error(`Unknown command: ${command}. Use --help.`);
  }
}
if (import.meta.main) {
  main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
