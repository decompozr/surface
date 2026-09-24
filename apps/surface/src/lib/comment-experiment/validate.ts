import type { Batch } from './model.ts';
const string = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;
export function validateBatch(value: unknown, recipient = 'local-fixture'): value is Batch {
  if (!value || typeof value !== 'object') return false;
  const b = value as Batch;
  return string(b.id, 100) && string(b.createdAt, 100) && string(b.page, 500) && string(b.revision, 100)
    && (b.handling === undefined || ['by-the-way', 'after-current'].includes(b.handling))
    && (b.delivery === undefined || (b.delivery && ['start', 'steer', 'queue'].includes(b.delivery.mode)
      && ['active', 'idle', 'notLoaded'].includes(b.delivery.expectedStatus)
      && (b.delivery.expectedTurnId === undefined || string(b.delivery.expectedTurnId, 200))))
    && b.recipient === recipient && b.status === 'pending' && Array.isArray(b.comments)
    && b.comments.length > 0 && b.comments.length <= 20
    && b.comments.every(c => c && string(c.id, 100) && typeof c.text === 'string' && c.text.length <= 4000
      && (c.text.trim().length > 0 || !!c.capture)
      && c.target && string(c.target.id, 100) && string(c.target.label, 300) && string(c.target.selector, 300)
      && typeof c.target.text === 'string' && c.target.text.length <= 1000 && string(c.target.revision, 100)
      && (!c.capture || (string(c.capture.png, 1_500_000) && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(c.capture.png)
        && Number.isFinite(c.capture.width) && c.capture.width > 0 && c.capture.width <= 10000
        && Number.isFinite(c.capture.height) && c.capture.height > 0 && c.capture.height <= 10000
        && string(c.capture.capturedAt, 100) && c.capture.method === 'dom-render'
        && c.capture.bounds && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(c.capture!.bounds[k as keyof typeof c.capture.bounds])))));
}
