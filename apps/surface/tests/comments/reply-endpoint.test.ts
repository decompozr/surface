import { expect, test } from 'bun:test';
import { replyEndpoint } from '../../src/lib/server/comments/reply-endpoint.ts';

const connection = { origin: 'http://127.0.0.1:4319', resultPath: '/api/comments/result', callbackToken: 'fixture' };
test('reply capabilities require an explicit same-origin destination', () => {
  expect(replyEndpoint(connection).href).toBe('http://127.0.0.1:4319/api/comments/result');
  expect(replyEndpoint({ ...connection, origin: 'https://surface.example' }).protocol).toBe('https:');
  for (const resultPath of [undefined, 'https://elsewhere.example/result', '//elsewhere.example/result', '/\\elsewhere.example/result', '/result#fragment', '/result?token=extra']) {
    expect(() => replyEndpoint({ ...connection, resultPath })).toThrow();
  }
  for (const origin of ['http://remote.example', 'https://user:password@surface.example', 'https://surface.example/nested', 'file:///tmp/result']) {
    expect(() => replyEndpoint({ ...connection, origin })).toThrow();
  }
  expect(() => replyEndpoint({ ...connection, callbackToken: '' })).toThrow();
});
