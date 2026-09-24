import { describe, expect, test } from 'bun:test';
import { allowsCommentOrigin } from './access.ts';
describe('explicit private preview origin', () => {
  test('keeps loopback access and permits only the configured HTTPS origin', async () => {
    const origin = 'https://preview.example.ts.net:8466';
    expect(allowsCommentOrigin(new URL('http://127.0.0.1:4387'))).toBe(true);
    expect(allowsCommentOrigin(new URL(origin))).toBe(false);
    expect(allowsCommentOrigin(new URL(origin + '/experiments/comments'), origin)).toBe(true);
    expect(allowsCommentOrigin(new URL('https://preview.example.ts.net:8467'), origin)).toBe(false);
    expect(allowsCommentOrigin(new URL('http://preview.example.ts.net:8466'), origin)).toBe(false);
    expect(allowsCommentOrigin(new URL('https://unrelated.example'), origin)).toBe(false);
  });
});
