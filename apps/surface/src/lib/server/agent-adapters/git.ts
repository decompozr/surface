import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
async function git(root: string, ...args: string[]) {
  // Git environment overrides must not redirect identity inspection to another repository.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const child = Bun.spawn(['git', '-C', root, ...args], { env, stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code !== 0) throw new Error('Git workspace inspection failed: ' + err.trim()); return out.trimEnd();
}
export async function inspectGit(root: string) {
  root = realpathSync(root);
  const [top, common, admin, inventory, branch] = await Promise.all([
    git(root, 'rev-parse', '--show-toplevel'), git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'),
    git(root, 'rev-parse', '--absolute-git-dir'), git(root, 'worktree', 'list', '--porcelain', '-z'), git(root, 'symbolic-ref', '--quiet', '--short', 'HEAD').catch(() => '(detached)'),
  ]);
  if (realpathSync(top) !== root) throw new Error('Register the Git worktree root; nested projects are outside this experiment.');
  const roots = inventory.split('\0').filter(part => part.startsWith('worktree ')).map(part => part.slice(9));
  if (!roots.some(path => existsSync(path) && realpathSync(path) === root)) throw new Error('Directory is not a registered Git worktree. Copied Git pointers are not adopted.');
  const commonDir = realpathSync(common), gitDir = realpathSync(admin);
  if (gitDir !== commonDir) {
    const backpointer = readFileSync(join(gitDir, 'gitdir'), 'utf8').trim();
    if (realpathSync(backpointer) !== realpathSync(join(root, '.git'))) throw new Error('Git worktree backpointer mismatch.');
  }
  return { root, commonDir, gitDir, branch, roots };
}
