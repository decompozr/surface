import { expect, test } from 'bun:test';
import { emptyState, restoreState } from './model.ts';
test('unsupported browser state is rejected instead of replaced with an empty draft', () => {
  const future = { ...emptyState(), version: 2, preserved: 'user draft' };
  expect(() => restoreState(future)).toThrow('Existing data was not changed');
  expect(future.preserved).toBe('user draft');
  expect(() => restoreState({ version: 1 })).toThrow();
  expect(restoreState(undefined)).toEqual(emptyState());
  const saved = emptyState(); saved.draft.text = 'Keep this';
  expect(restoreState(saved).draft.text).toBe('Keep this');
});
