import { cpSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';



export const workspaceFixture = async () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-app-workspace-')));
  const main = join(directory, 'main'), linked = join(directory, 'linked');
  mkdirSync(main);
  cpSync(join(import.meta.dir, '../../../examples'), join(main, 'ui'), {
    recursive: true, filter: path => !path.split('/').includes('node_modules'),
  });
  const projectId = crypto.randomUUID(), artifactId = crypto.randomUUID();
  writeFileSync(join(main, 'artifact.project.json'), JSON.stringify({ version: 1, projectId, name: 'App fixture', artifacts: [{ id: artifactId, name: 'Counter', source: 'ui', archived: false }] }));
  writeFileSync(join(main, '.gitignore'), 'node_modules/\n');
  await git(main, 'init', '-q', '-b', 'main');
  await git(main, 'config', 'commit.gpgsign', 'false');
  await git(main, 'add', '.'); await git(main, 'commit', '-qm', 'Fixture');
  await git(main, 'worktree', 'add', '-qb', 'fixture-linked', linked);
  return { directory, main, linked, projectId, artifactId, stateDir: join(directory, 'state'), dataRoot: join(directory, 'data') };
};



export const git = async (root: string, ...args: string[]) => {
  const child = Bun.spawn(['git', '-C', root, ...args], {
    env: { ...process.env, GIT_AUTHOR_NAME: 'Surface Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Surface Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (code) throw new Error(error);
  return out.trim();
};
