import { createServer } from 'node:net';
import { writeFileSync, readFileSync, unlinkSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const stop = (): Promise<void> => {
  if (!stopTask) stopTask = app.stop().then(() => {
    const current = JSON.parse(readFileSync(ownerPath, 'utf8'));
    if (current.nonce === nonce) unlinkSync(ownerPath);
  });
  return stopTask!;
};


// This runner only starts an installed host. Its private socket owns lifecycle control.
const [home, release, host, portValue] = process.argv.slice(2);
if (!home || !release || host !== 'surface') throw new Error('Invalid owned runner arguments.');
const secret = process.env.SURFACE_RUNNER_SECRET;
const nonce = process.env.SURFACE_RUNNER_NONCE;
if (!secret || !nonce) throw new Error('Missing launch identity.');
delete process.env.SURFACE_RUNNER_SECRET;
delete process.env.SURFACE_RUNNER_NONCE;
const socketPath = join(home, 'run/control.sock');
const ownerPath = join(home, 'run/owner.json');
const releasePath = join(home, 'releases', release);
const manifest = JSON.parse(readFileSync(join(releasePath, '.artifact-release.json'), 'utf8'));
if (manifest.release !== release || manifest.host !== host) throw new Error('Release identity mismatch.');
const { startSurface } = await import(pathToFileURL(join(releasePath, 'apps/surface/src/lib/server/http/surface.ts')).href);
const setupPath = join(home, 'agent-setup.json');
const access = existsSync(setupPath) ? JSON.parse(readFileSync(setupPath, 'utf8')).access : undefined;
let browserOrigin: string | undefined;
if (access?.enabled) {
  if (typeof access.host !== 'string' || !/^[a-z0-9.-]+$/i.test(access.host) || !Number.isInteger(access.port) || access.port < 1 || access.port > 65535) throw new Error('Invalid saved Tailscale origin. Run setup to configure access.');
  browserOrigin = `https://${access.host}:${access.port}`;
}
const app = await startSurface({ stateDir: join(home, 'state'), port: Number(portValue ?? 0), browserOrigin });
const publicOwner = { version: 1, release, commit: manifest.commit, host, pid: process.pid, nonce, instanceId: app.instanceId, origin: app.origin, browserOrigin };
const owner = { ...publicOwner, secret };
let stopTask: Promise<void> | undefined;
const same = (value: unknown) => {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};
const control = createServer(socket => {
  let input = '';
  socket.setTimeout(5000, () => socket.destroy());
  socket.on('data', chunk => {
    input += chunk.toString();
    if (input.length > 4096) { socket.destroy(); return; }
    if (!input.includes('\n')) return;
    socket.pause();
    void (async () => {
      try {
        const request = JSON.parse(input.slice(0, input.indexOf('\n')));
        if (!same(request.secret) || request.nonce !== nonce) throw new Error('Lifecycle authorization required.');
        if (request.operation === 'status') { socket.end(JSON.stringify({ ok: true, ...publicOwner }) + '\n'); return; }
        if (request.operation !== 'stop') throw new Error('Unknown lifecycle operation.');
        // Installation must not activate another release until this resolves.
        socket.setTimeout(0);
        await stop();
        socket.end(JSON.stringify({ ok: true, stopped: true, ...publicOwner }) + '\n');
        control.close(() => process.exit(0));
      } catch (error) { socket.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + '\n'); }
    })();
  });
});
try {
  await new Promise<void>((done, reject) => { control.once('error', reject); control.listen(socketPath, done); });
  chmodSync(socketPath, 0o600);
  writeFileSync(ownerPath, JSON.stringify(owner, null, 2), { mode: 0o600 });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void stop().finally(() => { control.close(); process.exit(0); }); });
} catch (error) { await app.stop(); throw error; }
