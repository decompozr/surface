import { error, type Handle } from '@sveltejs/kit';
export const handle: Handle = async ({ event, resolve }) => {
  const stateDir = event.platform?.req.artifactStateDir;
  if (!stateDir) error(503, 'Start through the Surface SvelteKit wrapper.');
  event.locals.artifactStateDir = stateDir;
  return resolve(event);
};
