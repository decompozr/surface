import { expect, test } from 'bun:test';
import { commentReply } from '../../src/lib/server/comments/result.ts';

test('comment results accept a message and optional stage without obsolete workflow instructions', () => {
  expect(commentReply({ requestId: 'fixture', result: { message: 'Done' } })).toEqual({ requestId: 'fixture', result: { message: 'Done' } });
  for (const stage of ['acknowledged', 'completed']) expect(commentReply({ requestId: 'fixture', result: { message: 'Reply', stage } }).result.stage).toBe(stage);
  for (const result of [{ message: ' ' }, { message: 'x'.repeat(20001) }, { message: 'Reply', stage: 'working' }, { message: 'Reply', next: 'continue-original' }]) {
    expect(() => commentReply({ requestId: 'fixture', result })).toThrow();
  }
  expect(() => commentReply(null)).toThrow();
});
