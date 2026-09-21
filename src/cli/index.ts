#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { scaffold } from './scaffold.ts';
import { projectMain } from './projects.ts';
import { startServer } from '../server/index.ts';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const cliPath = fileURLToPath(import.meta.url);

export async function main(args = process.argv.slice(2)) {
  const { values, positionals, tokens } = parseArgs({ args, allowPositionals: true, tokens: true, options: {
    directory: { type: 'string' }, framework: { type: 'string' }, runtime: { type: 'string' },
    'command-json': { type: 'string' }, 'schema-file': { type: 'string' }, 'preview-path': { type: 'string' },
    artifact: { type: 'string' }, source: { type: 'string' }, name: { type: 'string' },
    project: { type: 'string' }, thread: { type: 'string' }, socket: { type: 'string' },
    binding: { type: 'string' }, title: { type: 'string' }, request: { type: 'string' },
    data: { type: 'string' }, 'response-id': { type: 'string' }, port: { type: 'string' },
    'ui-port': { type: 'string' }, 'state-dir': { type: 'string' }, dev: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  const command = positionals[0];
  if (command === 'project') {
    const index = tokens.find(token => token.kind === 'positional')!.index;
    return projectMain(args.filter((_, position) => position !== index), join(root, '.decompozr/artifact/singleton'));
  }
  if (values.help || !command) {
    console.log(`Artifact prototype (Bun + TypeScript)

  project <operation> --project ROOT [--state-dir STATE] (use project --help)
  serve [--dev] [--port 4317] [--ui-port 5173]
  init --directory /path/to/project/artifacts/demo --framework svelte|vanilla
  doctor
  register --project /repo --directory /repo/ui --command-json '["bun","run","dev","--","--host","127.0.0.1","--port","{port}","--strictPort"]'
  mount --runtime ID
  runtimes
  runtime --runtime ID
  logs --runtime ID
  stop --runtime ID
  bind --project /path --thread UUID --socket /path/to/control.sock
  request --binding ID --title "Choose a design" [--runtime ID --schema-file /path/schema.json --preview-path /]
  list
  inspect --request ID
  send --request ID --response-id ID --data '{"option":"B","width":120,"comment":""}'
  result --request ID --data '{"message":"Updated","option":"B","width":120}'
  close --request ID

All commands accept --state-dir PATH (default: this checkout's .decompozr/artifact).
Project commands default to this checkout's .decompozr/artifact/singleton and require an existing singleton server.
serve runs in the foreground; Ctrl+C stops its own processes. --dev starts the Svelte Vite example.
Live bind/send commands target the exact registered Codex conversation. No mock agent runs in production.`);
    return;
  }
  const stateDir = resolve(values['state-dir'] ?? join(root, '.decompozr/artifact'));
  const required = (key: keyof typeof values) => {
    const value = values[key];
    if (typeof value !== 'string' || !value) throw new Error(`Missing --${key}.`);
    return value;
  };
  if (command === 'init') {
    console.log(JSON.stringify(scaffold(root, required('directory'), values.framework ?? 'svelte'), null, 2));
    return;
  }
  if (command === 'doctor') {
    let service: unknown;
    try {
      const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
      const url = new URL(connection.origin);
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') throw new Error('Invalid local connection origin.');
      const response = await fetch(new URL('/api/health', url), { signal: AbortSignal.timeout(1500) });
      if (!response.ok) throw new Error(`Health endpoint returned ${response.status}.`);
      service = { origin: url.origin, ...await response.json() as object };
    } catch (error) { service = { status: 'unavailable', error: error instanceof Error ? error.message : String(error) }; process.exitCode = 1; }
    console.log(JSON.stringify({ bun: Bun.version, platform: process.platform, cli: cliPath, stateDir, service, codexOnPath: !!Bun.which('codex'), scope: 'Service health only; binding validates the exact agent session. Runtime groups require a Unix platform.' }, null, 2));
    return;
  }
  if (command === 'serve') {
    const port = Number(values.port ?? 4317), uiPort = Number(values['ui-port'] ?? 5173);
    for (const number of [port, uiPort]) if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error('Invalid port.');
    const app = startServer({
      stateDir, cliPath, uiDir: join(root, 'examples/svelte-feedback/dist'), port,
      uiOrigin: values.dev ? `http://127.0.0.1:${uiPort}` : undefined,
    });
    let child: ReturnType<typeof Bun.spawn> | undefined;
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      child?.kill();
      await app.stop();
    };
    process.once('SIGINT', () => { void stop().then(() => process.exit(0)); });
    process.once('SIGTERM', () => { void stop().then(() => process.exit(0)); });
    if (values.dev) {
      try { child = Bun.spawn([process.execPath, join(root, 'examples/svelte-feedback/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'], {
        cwd: join(root, 'examples/svelte-feedback'),
        env: { ...process.env, ARTIFACT_API_ORIGIN: app.origin },
        stdout: 'inherit', stderr: 'inherit',
      }); } catch (error) { await stop(); throw error; }
      void child.exited.then(async code => { if (!stopping) { console.error(`Preview process exited (${code}).`); await stop(); process.exit(code || 1); } });
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
      if (!ready) { await stop(); throw new Error('The Svelte preview did not become ready.'); }
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
    if ((body as { status?: string }).status === 'failed') process.exitCode = 1;
    if (body.response?.status === 'failed' || body.response?.status === 'unknown') process.exitCode = 1;
  }
  switch (command) {
    case 'register': await api('/api/runtimes', { projectRoot: resolve(required('project')), directory: resolve(required('directory')), command: JSON.parse(required('command-json')) }); break;
    case 'runtimes': await api('/api/runtimes'); break;
    case 'runtime': await api(`/api/runtimes/${encodeURIComponent(required('runtime'))}`); break;
    case 'logs': await api(`/api/runtimes/${encodeURIComponent(required('runtime'))}/logs`); break;
    case 'mount': case 'stop': await api(`/api/runtimes/${encodeURIComponent(required('runtime'))}/${command}`, {}); break;
    case 'bind': await api('/api/bindings', { projectRoot: resolve(required('project')), threadId: required('thread'), socketPath: resolve(required('socket')) }); break;
    case 'request': await api('/api/requests', { bindingId: required('binding'), title: required('title'), runtimeId: values.runtime, previewPath: values['preview-path'], schema: values['schema-file'] ? JSON.parse(readFileSync(resolve(values['schema-file']), 'utf8')) : undefined }); break;
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
