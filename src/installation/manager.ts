import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, lstatSync, readdirSync, openSync, closeSync, unlinkSync, rmSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';

export type Host = 'singleton' | 'sveltekit' | 'contract' | 'surface';
type Release = { version: 1; release: string; commit: string; host: Host; bun: string; installedAt: string };
type Owner = { version: 1; release: string; commit: string; host: Host; pid: number; nonce: string; secret: string; instanceId: string; origin: string };
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));
function requireBun(directory: string, prepared?: Release) {
  const pkg = read<{ packageManager?: string }>(join(directory, 'package.json'));
  if (pkg.packageManager !== `bun@${Bun.version}`) throw new Error(`Release requires ${pkg.packageManager}; running bun@${Bun.version}.`);
  if (prepared && prepared.bun !== Bun.version) throw new Error(`Release was prepared with bun@${prepared.bun}; running bun@${Bun.version}.`);
}
function atomic(path: string, data: unknown) { writeFileSync(path + '.tmp', JSON.stringify(data, null, 2) + '\n', { mode: 0o600 }); renameSync(path + '.tmp', path); }
async function command(args: string[], cwd?: string) {
  const child = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code !== 0) throw new Error(`Command failed (${code}): ${args[0]} ${args.slice(1, 4).join(' ')}\n${stderr.slice(-8000)}${stdout.slice(-8000)}`);
  return stdout.trim();
}
function alive(pid: number) {
  if (!Number.isInteger(pid) || pid < 1) throw new Error('Invalid owned PID metadata.');
  try { process.kill(pid, 0); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}

export class Installation {
  readonly home: string;
  constructor(home: string, private readonly validateRelease?: (directory: string, stateDir: string) => Promise<void>) { this.home = resolve(home); }
  private initialize() {
    if (existsSync(this.home) && lstatSync(this.home).isSymbolicLink()) throw new Error('Installation home must not be a symlink.');
    mkdirSync(this.home, { recursive: true, mode: 0o700 });
    const marker = join(this.home, 'installation.json');
    if (!existsSync(marker)) {
      if (readdirSync(this.home).length) throw new Error('Refusing to adopt a nonempty unowned installation home.');
      atomic(marker, { version: 1, id: crypto.randomUUID() });
    }
    if (read<{version:number}>(marker).version !== 1) throw new Error('Unknown installation format.');
    for (const name of ['releases', 'run', 'state']) {
      const path = join(this.home, name);
      if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Owned installation directories must not be symlinks.');
      mkdirSync(path, { recursive: true, mode: 0o700 });
    }
  }
  private async locked<T>(fn: () => Promise<T>) {
    this.initialize();
    const lockPath = join(this.home, 'management.lock');
    let fd: number;
    try { fd = openSync(lockPath, 'wx', 0o600); } catch { throw new Error('Another lifecycle operation owns the installation lock. Do not delete a lock without inspecting its owner.'); }
    writeFileSync(fd, String(process.pid));
    try { return await fn(); } finally { closeSync(fd); unlinkSync(lockPath); }
  }
  private owner() { const path = join(this.home, 'run/owner.json'); return existsSync(path) ? read<Owner>(path) : undefined; }
  private ensureStopped() {
    if (this.owner() || existsSync(join(this.home, 'state/server.lock'))) throw new Error('Host ownership or lock remains. Stop the owned host or recover verified stale metadata first.');
  }
  private selected() {
    const active = read<Release>(join(this.home, 'active.json'));
    if (!/^[a-f0-9]{40}-(singleton|sveltekit|contract|surface)$/.test(active.release)) throw new Error('Invalid selected release identity.');
    const manifest = read<Release>(join(this.home, 'releases', active.release, '.artifact-release.json'));
    if (JSON.stringify(active) !== JSON.stringify(manifest)) throw new Error('Selected release manifest mismatch.');
    return active;
  }
  /** Serialize an explicit, stopped-only state operation with install/start/stop. */
  async withStoppedState<T>(operation: (stateDir: string, releaseDir: string) => Promise<T>) {
    return this.locked(async () => {
      this.ensureStopped();
      const release = this.selected();
      return operation(join(this.home, 'state'), join(this.home, 'releases', release.release));
    });
  }
  private async control(owner: Owner, operation: 'status' | 'stop') {
    return new Promise<any>((done, reject) => {
      const socket = createConnection(join(this.home, 'run/control.sock'));
      let received = '';
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('Owned lifecycle socket timed out. No signal was sent.')); }, operation === 'stop' ? 150_000 : 3000);
      socket.once('error', error => { clearTimeout(timer); reject(error); });
      socket.once('connect', () => socket.write(JSON.stringify({ operation, secret: owner.secret, nonce: owner.nonce }) + '\n'));
      socket.on('data', chunk => {
        received += chunk.toString();
        if (received.length > 65536) { clearTimeout(timer); socket.destroy(); reject(new Error('Oversized lifecycle response.')); return; }
        if (!received.includes('\n')) return;
        clearTimeout(timer); socket.destroy();
        try {
          const output = JSON.parse(received.slice(0, received.indexOf('\n')));
          if (!output.ok || output.nonce !== owner.nonce || output.pid !== owner.pid || output.release !== owner.release || output.instanceId !== owner.instanceId) throw new Error('Owned lifecycle identity could not be verified.');
          done(output);
        } catch (error) { reject(error); }
      });
      socket.on('end', () => { if (!received.includes('\n')) { clearTimeout(timer); reject(new Error('Lifecycle socket ended without a verified response.')); } });
    });
  }
  async install(repo: string, ref: string, host: Host = 'singleton', prepareEntry?: (directory: string, release: string) => Promise<void>) {
    return this.locked(async () => {
      this.ensureStopped();
      if (!['singleton', 'sveltekit', 'contract', 'surface'].includes(host)) throw new Error('Unknown host.');
      const commit = await command(['git', '-C', realpathSync(repo), 'rev-parse', '--verify', `${ref}^{commit}`]);
      if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected a full Git commit identity.');
      const release = `${commit}-${host}`;
      const directory = join(this.home, 'releases', release);
      if (existsSync(directory)) {
        const manifest = read<Release>(join(directory, '.artifact-release.json'));
        if (manifest.commit !== commit || manifest.host !== host || manifest.release !== release) throw new Error('Existing release identity mismatch.');
        requireBun(directory, manifest);
        await this.validateRelease?.(directory, join(this.home, 'state'));
        await prepareEntry?.(directory, release);
        atomic(join(this.home, 'active.json'), manifest); return manifest;
      }
      const staging = join(this.home, 'releases', `.preparing-${crypto.randomUUID()}`);
      const archive = staging + '.tar'; mkdirSync(staging);
      try {
        await command(['git', '-C', realpathSync(repo), 'archive', '--format=tar', `--output=${archive}`, commit]);
        await command(['tar', '-xf', archive, '-C', staging]);
        requireBun(staging);
        const mcpPackages = existsSync(join(staging, 'experiments/mcp/package.json')) ? ['experiments/mcp'] : [];
        for (const folder of ['', 'experiments/singleton', ...mcpPackages, ...(host !== 'singleton' ? ['experiments/sveltekit'] : [])]) {
          const cwd = join(staging, folder);
          if (!existsSync(join(cwd, 'bun.lock')) && !existsSync(join(cwd, 'bun.lockb'))) throw new Error(`Missing frozen Bun lockfile: ${folder || 'root'}.`);
          await command([process.execPath, 'install', '--frozen-lockfile', '--ignore-scripts'], cwd);
        }
        if (host !== 'singleton') await command([process.execPath, 'run', 'build'], join(staging, 'experiments/sveltekit'));
        await this.validateRelease?.(staging, join(this.home, 'state'));
        const manifest: Release = { version: 1, release, commit, host, bun: Bun.version, installedAt: new Date().toISOString() };
        atomic(join(staging, '.artifact-release.json'), manifest);
        renameSync(staging, directory);
        await prepareEntry?.(directory, release);
        // Activation is last: failed dependency preparation/build cannot displace the active release.
        atomic(join(this.home, 'active.json'), manifest);
        return manifest;
      } finally { rmSync(archive, { force: true }); rmSync(staging, { recursive: true, force: true }); }
    });
  }
  async activate(release: string) {
    return this.locked(async () => {
      this.ensureStopped();
      if (!/^[a-f0-9]{40}-(singleton|sveltekit|contract|surface)$/.test(release)) throw new Error('Invalid release identity.');
      const manifest = read<Release>(join(this.home, 'releases', release, '.artifact-release.json'));
      if (manifest.release !== release) throw new Error('Release manifest mismatch.');
      requireBun(join(this.home, 'releases', release), manifest);
      await this.validateRelease?.(join(this.home, 'releases', release), join(this.home, 'state'));
      atomic(join(this.home, 'active.json'), manifest); return manifest;
    });
  }
  async start(port?: number) {
    return this.locked(async () => {
      this.ensureStopped();
      const settingsPath = join(this.home, 'settings.json');
      port ??= existsSync(settingsPath) ? read<{port:number}>(settingsPath).port : 0;
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
      const release = this.selected();
      requireBun(join(this.home, 'releases', release.release), release);
      await this.validateRelease?.(join(this.home, 'releases', release.release), join(this.home, 'state'));
      if (join(this.home, 'run/control.sock').length > 100) throw new Error('Installation home is too long for this Unix control socket experiment.');
      const runner = join(this.home, 'run/runner.ts');
      writeFileSync(runner, readFileSync(join(import.meta.dir, 'runner.ts')), { mode: 0o600 });
      const secret = randomBytes(32).toString('hex'), nonce = crypto.randomUUID();
      const log = openSync(join(this.home, 'run/host.log'), 'a', 0o600);
      const child = Bun.spawn([process.execPath, runner, this.home, release.release, release.host, String(port)], {
        env: { ...process.env, SURFACE_RUNNER_SECRET: secret, SURFACE_RUNNER_NONCE: nonce }, stdin: 'ignore', stdout: log, stderr: log,
      });
      closeSync(log);
      let exited = false; void child.exited.then(() => { exited = true; });
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline && !exited) {
        const owner = this.owner();
        if (owner?.nonce === nonce && owner.pid === child.pid) {
          const status = await this.control(owner, 'status');
          atomic(settingsPath, { port }); child.unref();
          return { status, child };
        }
        await Bun.sleep(50);
      }
      // A live child from this launch is the only process this manager may signal.
      if (!exited) { child.kill(); await child.exited; }
      throw new Error('Installed host did not become ready. Inspect run/host.log; retained ownership may require recovery.');
    });
  }
  async health() {
    this.initialize(); const owner = this.owner();
    if (!owner) return { status: 'stopped' };
    const lifecycle = await this.control(owner, 'status');
    const response = await fetch(new URL('/api/health', owner.origin), { signal: AbortSignal.timeout(3000) });
    const service = await response.json() as { instanceId?:string;pid?:number };
    if (!response.ok || service.instanceId !== owner.instanceId || service.pid !== owner.pid) throw new Error('Installed host health identity differs from owner.');
    return { status: 'running', lifecycle, service };
  }
  async stop() {
    return this.locked(async () => {
      const owner = this.owner();
      if (!owner) { this.ensureStopped(); return { status: 'stopped' }; }
      await this.control(owner, 'status');
      await this.control(owner, 'stop');
      const deadline = Date.now() + 5000;
      while (alive(owner.pid) && Date.now() < deadline) await Bun.sleep(20);
      if (alive(owner.pid)) throw new Error('Owned host acknowledged stop but has not exited. No signal was sent.');
      return { status: 'stopped' };
    });
  }
  async recover() {
    return this.locked(async () => {
      const owner = this.owner();
      if (!owner) throw new Error('No owned launch metadata; refusing automatic stale lock recovery.');
      if (alive(owner.pid)) throw new Error('Recorded PID is live or reused. Recovery will not signal or remove its lock.');
      const stateLock = join(this.home, 'state/server.lock'), connection = join(this.home, 'state/connection.json');
      if (!existsSync(stateLock) || readFileSync(stateLock, 'utf8').trim() !== String(owner.pid)) throw new Error('Stale lock ownership mismatch.');
      const saved = read<{pid:number;instanceId:string;origin:string}>(connection);
      if (saved.pid !== owner.pid || saved.instanceId !== owner.instanceId || saved.origin !== owner.origin) throw new Error('Stale connection ownership mismatch.');
      const socket = join(this.home, 'run/control.sock');
      if (existsSync(socket) && !lstatSync(socket).isSocket()) throw new Error('Refusing to delete an unexpected control path.');
      // A reachable socket may belong to a newer owner even if the saved PID is dead.
      const reachable = await new Promise<boolean>((done, reject) => {
        const client = createConnection(socket);
        const timer = setTimeout(() => { client.destroy(); reject(new Error('Cannot establish whether the control socket is live.')); }, 3000);
        client.once('connect', () => { clearTimeout(timer); client.destroy(); done(true); });
        client.once('error', error => {
          clearTimeout(timer);
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ENOENT' || code === 'ECONNREFUSED') done(false); else reject(error);
        });
      });
      if (reachable) throw new Error('Control socket is live. Refusing stale recovery.');
      const archive = join(this.home, 'recovery', crypto.randomUUID()); mkdirSync(archive, { recursive: true, mode: 0o700 });
      for (const [path, name] of [[stateLock, 'server.lock'], [connection, 'connection.json'], [join(this.home, 'run/owner.json'), 'owner.json']] as const) renameSync(path, join(archive, name));
      if (existsSync(socket)) unlinkSync(socket);
      return { status: 'recovered', archive, release: owner.release };
    });
  }
  async uninstall() {
    return this.locked(async () => {
      this.ensureStopped();
      const interactionsPath = join(this.home, 'state/interactions.json');
      if (existsSync(interactionsPath)) {
        const interactions = read<{ version: number; requests: { response?: { status: string }; result?: unknown }[] }>(interactionsPath);
        if (interactions.version !== 1 || !Array.isArray(interactions.requests)) throw new Error('Cannot establish whether saved interactions still require callback executables.');
        if (interactions.requests.some(request => request.response && ['accepted', 'delivering', 'unknown'].includes(request.response.status) && request.result === undefined)) {
          throw new Error('Unresolved agent callbacks still reference installed release executables. Reconcile those interactions before uninstalling; closing does not cancel a delivered turn.');
        }
      }
      rmSync(join(this.home, 'releases'), { recursive: true, force: true });
      rmSync(join(this.home, 'run'), { recursive: true, force: true });
      rmSync(join(this.home, 'active.json'), { force: true });
      return { status: 'uninstalled', preservedState: join(this.home, 'state'), preservedRecovery: join(this.home, 'recovery') };
    });
  }
}
