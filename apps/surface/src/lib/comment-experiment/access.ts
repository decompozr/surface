/** Allow loopback and, when explicitly configured, one private HTTPS origin. */
export function allowsCommentOrigin(url: URL, configuredOrigin?: string): boolean {
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
  return url.protocol === 'https:' && configuredOrigin === url.origin;
}
