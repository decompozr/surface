import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { projectOperation, projectOperations, type ProjectCommand } from '@decompozr/surface-client/management';

export async function projectMain(args: string[], defaultStateDir: string): Promise<void> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    project: { type: 'string' }, artifact: { type: 'string' }, source: { type: 'string' }, name: { type: 'string' },
    'state-dir': { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log(`surface project <init|add|list|register|mount|unmount|archive|restore> --project ROOT [--artifact ID --source PATH --name LABEL] [--state-dir STATE]
Uses an existing server. Source paths are relative to the project root.
init accepts --name; add requires --source and --name.
mount, unmount, archive and restore require --artifact. list and register take only --project.`);
    return;
  }
  const operation = positionals[0] as ProjectCommand['operation'];
  if (positionals.length !== 1 || !projectOperations.includes(operation)) throw new Error('Expected one project operation. Use surface project --help.');
  if (!values.project) throw new Error('Missing --project.');
  const command: ProjectCommand = { operation, projectRoot: resolve(values.project) };
  if (values.artifact !== undefined) command.artifactId = values.artifact;
  if (values.source !== undefined) command.source = values.source;
  if (values.name !== undefined) command.name = values.name;
  const outcome = await projectOperation(resolve(values['state-dir'] ?? defaultStateDir), command);
  console.log(JSON.stringify(outcome, null, 2));
  if (!outcome.ok) process.exitCode = 1;
}
