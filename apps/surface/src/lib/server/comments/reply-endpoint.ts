/** Validate the explicit callback destination before sending its capability. */
export const replyEndpoint = (config: { origin?: unknown; resultPath?: unknown; callbackToken?: unknown }): URL => {
  if (typeof config.origin !== 'string' || typeof config.resultPath !== 'string'
    || typeof config.callbackToken !== 'string' || !config.callbackToken) {
    throw new Error('Expected an explicit comment reply connection.');
  }
  const origin = new URL(config.origin);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if ((origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local))
    || origin.username || origin.password || origin.href !== `${origin.origin}/`) {
    throw new Error('Expected an HTTPS or local comment reply origin.');
  }
  const endpoint = new URL(config.resultPath, origin);
  if (!config.resultPath.startsWith('/') || config.resultPath.startsWith('//')
    || endpoint.origin !== origin.origin || endpoint.search || endpoint.hash) {
    throw new Error('Expected a same-origin comment reply path.');
  }
  return endpoint;
};
