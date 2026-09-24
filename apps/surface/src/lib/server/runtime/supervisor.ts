// Keep the project's process group tied to the manager's stdin pipe, even if
// the manager is killed. Only this newly created group is ever signalled.
import { spawn } from 'node:child_process';

const stop = (code: number) => {
  if (stopping) return;
  stopping = true;
  try { process.kill(-process.pid, 'SIGTERM'); } catch { /* group already gone */ }
  setTimeout(() => { try { process.kill(-process.pid, 'SIGKILL'); } catch { process.exit(code); } }, 300);
};

const command = JSON.parse(process.argv[2]!) as string[];
let stopping = false;
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
process.stdin.on('end', () => stop(0));
process.stdin.resume();
const child = spawn(command[0]!, command.slice(1), { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
child.once('error', error => { console.error(error.message); stop(1); });
child.once('exit', code => stop(code ?? 1));
