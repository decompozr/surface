import type { Handle } from '@sveltejs/kit';

export const handle: Handle = ({ event, resolve }) => {
  event.locals.surfaceNavigation = event.platform?.req.surfaceNavigation;
  event.locals.surfaceRuntime = event.platform?.req.surfaceRuntime;
  return resolve(event);
};
