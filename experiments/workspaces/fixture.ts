import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

export async function command(args: string[], cwd?: string, env?: Record<string,string>) {
  const child = Bun.spawn(args, { cwd, env: { ...process.env, GIT_AUTHOR_NAME: 'Surface Workspace Fixture', GIT_AUTHOR_EMAIL: 'surface@example.invalid', GIT_COMMITTER_NAME: 'Surface Workspace Fixture', GIT_COMMITTER_EMAIL: 'surface@example.invalid', ...env }, stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, out: out.trim(), err: err.trim() };
}
export async function git(root: string, ...args: string[]) {
  const result = await command(['git', '-C', root, ...args]); if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.err}`); return result.out;
}
export async function fixture() {
  const directory = realpathSync(mkdtempSync('/tmp/surface-workspaces-')), main = join(directory, 'main'), a = join(directory, 'branch-a'), b = join(directory, 'branch-b');
  mkdirSync(join(main, 'ui/src'), { recursive: true });
  const projectId = crypto.randomUUID(), artifactId = crypto.randomUUID();
  const manifest = { version: 1 as const, projectId, name: 'Workspace experiment', artifacts: [{ id: artifactId, name: 'Scenarios', source: 'ui', archived: false }] };
  writeFileSync(join(main, 'artifact.project.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(main, '.gitignore'), 'node_modules/\nui/bun.lock\n.artifact-project.lock\n');
  writeFileSync(join(main, 'ui/package.json'), JSON.stringify({ name: 'workspace-scenarios', private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(main, 'ui/artifact.json'), JSON.stringify({ framework: 'svelte', components: 'src', props: { 'src/Scenarios.svelte': { label: 'Workspace' } } }));
  copyFileSync(join(import.meta.dir, '../project-database/fixtures/Scenarios.svelte'), join(main, 'ui/src/Scenarios.svelte'));
  copyFileSync(join(import.meta.dir, '../../tests/e2e/runtime/fixtures/InteractionForm.svelte'), join(main, 'ui/src/Form.svelte'));
  writeFileSync(join(main, 'backend.ts'), readFileSync(join(import.meta.dir, '../project-database/fixtures/backend.ts'), 'utf8') + '\nexport const apiVersion = 1;\n');
  writeFileSync(join(main, 'surface.backend.json'), JSON.stringify({ version: 1, api: 1, entry: 'backend.ts', operations: ['describeProject','listScenarios','saveScenario'] }));
  await git(main, 'init', '-q', '-b', 'main'); await git(main, 'config', 'commit.gpgsign', 'false');
  await git(main, 'add', '.'); await git(main, 'commit', '-qm', 'Initial project and reusable Surface source');
  await git(main, 'worktree', 'add', '-qb', 'experiment-a', a); await git(main, 'worktree', 'add', '-qb', 'experiment-b', b);
  return { directory, main, a, b, manifest, state: join(directory, 'shared-service'), data: join(directory, 'persistent-project-data') };
}
