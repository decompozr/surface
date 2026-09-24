import { describe, expect, test } from 'bun:test';
import { validateBatch } from './validate.ts';
import { emptyState, type Batch } from './model.ts';
const batch = (): Batch => ({ id: 'batch-1', createdAt: '2026-09-23T00:00:00Z', page: '/experiments/comments', revision: 'v1', recipient: 'local-fixture', status: 'pending', comments: [{ id: 'comment-1', target: { id: 'headline', label: 'Heading', selector: '#headline', text: 'Original title', revision: 'v1' }, text: 'Smaller, please.' }] });
describe('comment batch boundary', () => {
  test('retains target context and groups multiple comments in one batch', () => {
    const value = batch(); value.comments.push({ ...value.comments[0], id: 'comment-2', text: 'More space.' });
    expect(validateBatch(JSON.parse(JSON.stringify(value)))).toBe(true);
    expect(emptyState().batches).toEqual([]);
  });
  test('rejects real recipients, empty batches, empty comments and oversized text', () => {
    expect(validateBatch({ ...batch(), recipient: 'real-conversation' })).toBe(false);
    expect(validateBatch({ ...batch(), comments: [] })).toBe(false);
    const value = batch(); value.comments[0].text = ' '; expect(validateBatch(value)).toBe(false);
    value.comments[0].text = 'a'.repeat(4001); expect(validateBatch(value)).toBe(false);
  });
  test('accepts image-only feedback and rejects invalid image data and geometry', () => {
    const value = batch(); value.comments[0].text = '';
    value.comments[0].capture = { png: 'data:image/png;base64,YQ==', width: 100, height: 50, capturedAt: value.createdAt, method: 'dom-render', bounds: { x: 0, y: 0, width: 100, height: 50 } };
    expect(validateBatch(value)).toBe(true);
    value.comments[0].capture.width = -1; expect(validateBatch(value)).toBe(false);
    value.comments[0].capture.width = 100; value.comments[0].capture.png = 'data:text/html;base64,YQ=='; expect(validateBatch(value)).toBe(false);
  });
  test('rejects malformed objects without throwing', () => {
    for (const value of [null, false, [], {}, { ...batch(), comments: [null] }, { ...batch(), comments: [{ ...batch().comments[0], capture: {} }] }]) expect(validateBatch(value)).toBe(false);
  });
});
