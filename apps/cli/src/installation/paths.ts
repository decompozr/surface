import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

export const installationHome = (explicit?: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform, userHome = homedir()) => {
  if (explicit || env.SURFACE_HOME) return resolve(explicit || env.SURFACE_HOME!);
  if (platform === 'darwin' || platform === 'linux') return join(userHome, '.decompozr/surface');
  throw new Error('Specify --home on this platform.');
};

export const serviceState = (values: { home?: string; 'state-dir'?: string }, env: NodeJS.ProcessEnv = process.env) => {
  if (values.home && values['state-dir']) throw new Error('Select either --home or --state-dir, not both.');
  return resolve(values['state-dir'] ?? (values.home ? join(installationHome(values.home,env),'state') : env.SURFACE_STATE_DIR ?? join(installationHome(undefined,env),'state')));
};
