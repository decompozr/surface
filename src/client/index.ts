/** Browser-only client. Copy via `surface init`; no server credentials belong here. */
export type DeliveryIntent = { mode: 'queue' | 'steer' | 'start'; expectedStatus: string; expectedTurnId?: string };
export type Recipient = { threadId: string; status: string; turnId?: string; canSubmit: boolean };
export type AgentRow = { id: string; title: string; provider: string; workspaceId: string; projectRoot: string; status: string };
export type Directory = { available: boolean; worktree: AgentRow[]; project: AgentRow[]; checkedAt: string };
const deliveryChoices = new Map<string, DeliveryIntent>();
export type Interaction = {
  recipientSelection?: boolean; replacedBy?: string;
  id: string; title: string; closed: boolean; schema: Record<string, unknown>;
  response?: { id: string; status: 'delivering' | 'accepted' | 'failed' | 'unknown'; error?: string; delivery?: DeliveryIntent; receipt?: { mode: string; turnId?: string; queuedSubmissionId?: string }; data: Record<string, unknown> };
  result?: Record<string, unknown>;
};
export function createSurfaceClient(options?: { api: string; requestId: string; token: string }) {
  const page = new URL(location.href);
  const fragment = new URLSearchParams(page.hash.slice(1));
  const api = options?.api ?? fragment.get('api') ?? location.origin;
  const requestId = options?.requestId ?? page.searchParams.get('request');
  const token = options?.token ?? fragment.get('token');
  if (!requestId || !token) throw new Error('Open the interaction preview URL returned by Surface.');
  const endpoint = new URL(api);
  if ((endpoint.origin !== location.origin && (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1')) || !['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Expected a local Surface API.');
  const context = document.getElementById('artifact-preview-context');
  const scopedBase = context ? JSON.parse(context.textContent ?? '{}').interactionBase : undefined;
  if (scopedBase !== undefined && (typeof scopedBase !== 'string' || !/^\/api\/n\/[a-z0-9-]+\/[a-z0-9-]+\/requests\/$/.test(scopedBase))) throw new Error('Invalid preview interaction scope.');
  const base = new URL(`${scopedBase ?? '/api/requests/'}${encodeURIComponent(requestId)}`, endpoint).href;
  async function call(path: string, data?: unknown): Promise<Interaction> {
    const response = await fetch(base + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(90_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? `Surface returned HTTP ${response.status}.`);
    return result;
  }
  return {
    read: () => call(''),
    configureDelivery: (intent?: DeliveryIntent) => { if (intent) deliveryChoices.set(base, intent); else deliveryChoices.delete(base); },
    directory: () => call('/recipients') as unknown as Promise<Directory>,
    takeOver: (threadId: string) => call('/takeover', { threadId }) as unknown as Promise<Interaction & { token: string }>,
    recipient: () => call('/recipient') as unknown as Promise<Recipient>,
    // Retain this ID on a transport failure. Never create a new ID to retry an uncertain delivery.
    submit: (data: Record<string, unknown>, responseId: string, delivery?: DeliveryIntent) => call('/responses', { responseId, data, delivery: delivery ?? deliveryChoices.get(base) }),
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

/** Compatibility export for existing mounted sources. New code uses createSurfaceClient. */
export const createArtifactClient = createSurfaceClient;
