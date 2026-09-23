import { expect, test } from 'bun:test';
import { resolveRequestId, shortRequestId } from './reply-id';
const a = 'b66e6e8a-0f51-4520-945e-39fb9615c3ec';
const b = 'b66e6e8a-1f51-4520-945e-39fb9615c3ec';
test('short reply references resolve exactly and expand on collisions', () => {
  expect(shortRequestId(a, [{ id: a }])).toBe('b66e6e8a');
  expect(resolveRequestId('b66e6e8a', [{ id: a }])).toBe(a);
  expect(() => resolveRequestId('b66e6e8a', [{ id: a }, { id: b }])).toThrow('Ambiguous');
  const short = shortRequestId(a, [{ id: a }, { id: b }]);
  expect(resolveRequestId(short, [{ id: a }, { id: b }])).toBe(a);
  expect(() => resolveRequestId('deadbeef', [{ id: a }])).toThrow('Unknown');
  expect(() => resolveRequestId('latest', [{ id: a }])).toThrow('at least 8');
});
