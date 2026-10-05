import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

let source = resolve(import.meta.dir, '../../../../..');
export const configurePrompts = (directory: string) => { source = directory; };
/** Use dependencies shipped in the selected release; setup never installs dependencies. */
export const loadPrompts = async (): Promise<typeof import('@clack/prompts')> => {
  const require = createRequire(join(source, 'package.json'));
  return import(require.resolve('@clack/prompts'));
};
