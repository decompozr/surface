/** Browser-only client. Copy via `artifact init`; no server credentials belong here. */
export type Interaction = {
  id: string; title: string; closed: boolean; schema: Record<string, unknown>;
  response?: { id: string; status: 'delivering' | 'accepted' | 'failed' | 'unknown'; error?: string; data: Record<string, unknown> };
  result?: Record<string, unknown>;
};
export function createArtifactClient(options?: { api: string; requestId: string; token: string }) {
  const page = new URL(location.href);
  const fragment = new URLSearchParams(page.hash.slice(1));
  const api = options?.api ?? fragment.get('api') ?? location.origin;
  const requestId = options?.requestId ?? page.searchParams.get('request');
  const token = options?.token ?? fragment.get('token');
  if (!requestId || !token) throw new Error('Open the interaction preview URL returned by Artifact.');
  const endpoint = new URL(api);
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password) throw new Error('Expected a local Artifact API.');
  const base = new URL(`/api/requests/${encodeURIComponent(requestId)}`, endpoint).href;
  async function call(path: string, data?: unknown): Promise<Interaction> {
    const response = await fetch(base + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(90_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? `Artifact returned HTTP ${response.status}.`);
    return result;
  }
  return {
    read: () => call(''),
    // Retain this ID on a transport failure. Never create a new ID to retry an uncertain delivery.
    submit: (data: Record<string, unknown>, responseId: string) => call('/responses', { responseId, data }),
    async waitForResult(options: { timeoutMs?: number; signal?: AbortSignal } = {}) {
      const deadline = Date.now() + (options.timeoutMs ?? 120_000);
      while (Date.now() < deadline) {
        options.signal?.throwIfAborted();
        const request = await call('');
        if (request.result) return request.result;
        if (request.closed) throw new Error('Interaction closed before a result was published.');
        if (request.response?.status === 'failed' || request.response?.status === 'unknown') throw new Error(request.response.error ?? request.response.status);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('No result yet. Inspect the existing request; do not resubmit automatically.');
    },
  };
}
