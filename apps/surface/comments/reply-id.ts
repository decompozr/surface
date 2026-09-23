type Identified = { id: string };
/** A short reference must still resolve to exactly one durable request. */
export function resolveRequestId(reference: string, requests: Identified[]): string {
  if (!/^[a-f0-9-]{8,36}$/i.test(reference)) throw new Error('Use a request ID or an unambiguous prefix of at least 8 characters.');
  const matches = requests.filter(request => request.id.startsWith(reference));
  if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous request prefix; use more characters.' : 'Unknown request reference.');
  return matches[0].id;
}
export function shortRequestId(id: string, requests: Identified[]): string {
  for (let length = 8; length <= id.length; length++) {
    const prefix = id.slice(0, length);
    if (requests.filter(request => request.id.startsWith(prefix)).length === 1) return prefix;
  }
  throw new Error('Cannot create a unique request reference.');
}
