import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Older installed releases retain their original layout; never rewrite their source. */
export const installationSource = (release: string, file: string) => {
  const layouts = ['apps/cli/src/installation', 'apps/installer/src', 'apps/surface/src/installation', 'src/installation'];
  const path = layouts.map(layout => join(release, layout, file)).find(existsSync);
  if (!path) throw new Error(`Release is missing installation source: ${file}`);
  return path;
};
