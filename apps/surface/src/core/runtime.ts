import { spawn, type ChildProcess } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { InputError, object, text } from './service.ts';
import type { Store } from './store.ts';

export type RuntimeDefinition = { id: string; projectRoot: string; directory: string; command: string[]; createdAt: string };
export type RuntimeStatus = 'starting' | 'ready' | 'failed' | 'stopped';
type Live = { status: RuntimeStatus; process?: ChildProcess; exited?: Promise<void>; origin?: string; error?: string; log: string; start?: Promise<unknown>; stopping?: Promise<void> };
export function within(root: string, directory: string) {
  const path = relative(root, directory);
  return path === '' || (!path.startsWith('..' + '/') && path !== '..' && !isAbsolute(path));
}
async function availablePort() {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

/** One owned process group per trusted local project. This is not a sandbox. */
export class Runtimes {
  private live = new Map<string, Live>();
  private closing = false;
  constructor(private store: Store, private timeout = 15_000) {}
  register(input: unknown) {
    const data = object(input);
    let projectRoot: string, directory: string;
    try {
      projectRoot = realpathSync(text(data.projectRoot, 'project root'));
      directory = realpathSync(text(data.directory, 'runtime directory'));
      if (!statSync(projectRoot).isDirectory() || !statSync(directory).isDirectory()) throw new Error();
    } catch { throw new InputError('Project and runtime directories must exist.'); }
    if (!within(projectRoot, directory)) throw new InputError('Runtime directory must be within the registered project.');
    if (!Array.isArray(data.command) || !data.command.length || data.command.length > 100) throw new InputError('Expected a nonempty command argument array.');
    const command = data.command.map(arg => text(arg, 'command argument', 4000));
    return this.store.update(state => {
      const existing = state.runtimes.find(item => item.projectRoot === projectRoot && item.directory === directory && JSON.stringify(item.command) === JSON.stringify(command));
      if (existing) return this.inspect(existing.id);
      const record = { id: crypto.randomUUID(), projectRoot, directory, command, createdAt: new Date().toISOString() };
      state.runtimes.push(record);
      return { ...record, status: 'stopped' as const };
    });
  }
  definition(id: string) {
    const record = this.store.state.runtimes.find(item => item.id === id);
    if (!record) throw new InputError('Unknown runtime.', 404);
    return record;
  }
  inspect(id: string) {
    const record = this.definition(id), live = this.live.get(id);
    return { ...record, status: live?.status ?? 'stopped', previewUrl: live?.status === 'ready' ? live.origin : undefined, error: live?.error };
  }
  list() { return this.store.state.runtimes.map(item => this.inspect(item.id)); }
  logs(id: string) { this.definition(id); return { runtimeId: id, log: this.live.get(id)?.log ?? '' }; }
  isOrigin(origin: string) { return [...this.live.values()].some(live => live.status === 'ready' && live.origin === origin); }
  async mount(id: string): Promise<ReturnType<Runtimes['inspect']>> {
    if (process.platform === 'win32') throw new InputError('Runtime supervision currently requires a Unix platform.');
    if (this.closing) throw new InputError('Service is shutting down.', 409);
    const definition = this.definition(id);
    const current = this.live.get(id);
    if (current?.stopping) { await current.stopping; return this.mount(id); }
    if (current?.start) { await current.start; return this.inspect(id); }
    if (current?.status === 'ready') return this.inspect(id);
    const live: Live = { status: 'starting', log: '' };
    this.live.set(id, live);
    live.start = this.launch(definition, live);
    try { await live.start; } finally { live.start = undefined; }
    return this.inspect(id);
  }
  private async launch(definition: RuntimeDefinition, live: Live) {
    try {
      // Recheck canonical paths after registration; never follow a replaced root silently.
      if (realpathSync(definition.projectRoot) !== definition.projectRoot || realpathSync(definition.directory) !== definition.directory) throw new Error('Registered paths changed. Register the intended project again.');
      const port = await availablePort();
      if (live.status !== 'starting' || this.closing) return;
      live.origin = `http://127.0.0.1:${port}`;
      const command = definition.command.map(arg => arg.replaceAll('{port}', String(port)));
      const child = spawn(process.execPath, [fileURLToPath(new URL('../runtime/supervisor.ts', import.meta.url)), JSON.stringify(command)], {
        cwd: definition.directory, env: { ...process.env, SURFACE_PORT: String(port), ARTIFACT_PORT: String(port), HOST: '127.0.0.1' },
        detached: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      live.process = child;
      const append = (chunk: Buffer) => { live.log = (live.log + chunk.toString()).slice(-65536); };
      child.stdout?.on('data', append); child.stderr?.on('data', append);
      live.exited = new Promise(resolve => {
        const exit = (reason: string) => {
          if (live.status === 'starting' || live.status === 'ready') { live.status = 'failed'; live.error = reason; }
          resolve();
        };
        child.once('error', error => exit(error.message));
        child.once('exit', (code, signal) => exit(`Runtime exited (${signal ?? code}).`));
      });
      const deadline = Date.now() + this.timeout;
      while (live.status === 'starting' && Date.now() < deadline) {
        try {
          const response = await fetch(live.origin, { redirect: 'manual', signal: AbortSignal.timeout(500) });
          await response.body?.cancel();
          if (response.ok && live.status === 'starting') { live.status = 'ready'; return; }
        } catch { /* not ready */ }
        await Bun.sleep(100);
      }
      if (live.status === 'starting') { live.status = 'failed'; live.error = 'Runtime did not become ready. Inspect its logs and startup command.'; }
      await this.terminate(live);
    } catch (error) {
      live.status = 'failed'; live.error = error instanceof Error ? error.message : 'Runtime startup failed.';
      await this.terminate(live);
    }
  }
  private async terminate(live: Live) {
    const child = live.process;
    if (!child?.pid) return;
    const signal = (name: NodeJS.Signals) => { try { process.kill(-child.pid!, name); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; } };
    signal('SIGTERM');
    // Give the entire owned group time to exit, including grandchildren.
    await Bun.sleep(150);
    signal('SIGKILL');
    await live.exited;
    live.process = undefined;
  }
  async stop(id: string) {
    this.definition(id);
    const live = this.live.get(id);
    if (live) {
      if (!live.stopping) {
        live.status = 'stopped';
        live.stopping = (async () => { await live.start; await this.terminate(live); })();
      }
      try { await live.stopping; } finally { live.stopping = undefined; }
    }
    return this.inspect(id);
  }
  async shutdown() {
    this.closing = true;
    await Promise.all([...this.live.keys()].map(id => this.stop(id)));
  }
}
