import { scaffold as createFromTemplate } from '@decompozr/surface-app/server/templates/index';

/** Retain the legacy local CLI signature; the app resolves its own template assets. */
export const scaffold = (_root: string, directory: string, framework: string) => {
  return createFromTemplate(directory, framework);
};
