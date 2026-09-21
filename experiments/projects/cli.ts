import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { ProjectManager } from './project.ts';
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  project: { type: 'string' }, 'state-dir': { type: 'string' }, source: { type: 'string' }, name: { type: 'string' }, artifact: { type: 'string' }, help: { type: 'boolean' },
} });
try {
  const [command] = positionals;
  if (values.help || !command) console.log(`Artifact project-management experiment
init --project ROOT [--name LABEL]
add --project ROOT --source RELATIVE_FOLDER --name LABEL
list --project ROOT
register --project ROOT --state-dir SINGLETON_STATE
mount|unmount|archive --project ROOT --artifact ID --state-dir SINGLETON_STATE
restore --project ROOT --artifact ID
Names are labels; stable UUIDs determine singleton namespace/mount identity.
Archive preserves all source/dependencies; restore does not automatically mount.`);
  else {
    if (!values.project) throw new Error('Expected --project ROOT.');
    const manager = new ProjectManager(values.project, values['state-dir'] ? resolve(values['state-dir']) : undefined);
    let output: unknown;
    switch (command) {
      case 'init': output = await manager.init(values.name); break;
      case 'add': if (!values.source || !values.name) throw new Error('Expected --source and --name.'); output = await manager.add(values.source, values.name); break;
      case 'list': output = manager.list(); break;
      case 'register': output = await manager.register(); break;
      case 'mount': output = await manager.mount(values.artifact); break;
      case 'unmount': output = await manager.unmount(values.artifact); break;
      case 'archive': output = await manager.archive(values.artifact); break;
      case 'restore': output = await manager.restore(values.artifact); break;
      default: throw new Error('Unknown command. Use --help.');
    }
    console.log(JSON.stringify(output, null, 2));
  }
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
