import { CSRF_KEY_PREFIX } from '../constants';
import { createValueKey } from './create-value-key';

describe('createValueKey', () => {
  it('should concatenate prefix, sessionId and token with ":"', () => {
    const sessionId = 'abc123';
    const token = 'token456';
    const result = createValueKey(sessionId, token);
    expect(result).toBe(`${CSRF_KEY_PREFIX}:${sessionId}:${token}`);
  });

  it('should work with empty strings', () => {
    expect(createValueKey('', '')).toBe(`${CSRF_KEY_PREFIX}::`);
  });

  it('should work with special characters', () => {
    const sessionId = 'a:b/c';
    const token = 't:o@k#e$n';
    const result = createValueKey(sessionId, token);
    expect(result).toBe(`${CSRF_KEY_PREFIX}:${sessionId}:${token}`);
  });
});
