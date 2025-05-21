import { CSRF_DEFAULT_OPTIONS, DEFAULT_HEADER_KEY, DEFAULT_KEY } from './constants';
import type { CsrfDoubleCsrfOptions, CsrfSessionOptions } from './types';

describe('CSRF_DEFAULT_OPTIONS', () => {
  it('should have expected default values', () => {
    expect(CSRF_DEFAULT_OPTIONS.saltLength).toBe(8);
    expect(CSRF_DEFAULT_OPTIONS.secretLength).toBe(18);
    expect(CSRF_DEFAULT_OPTIONS.headerKey).toBe(DEFAULT_HEADER_KEY);
    expect(CSRF_DEFAULT_OPTIONS.verifyMethods).toEqual(['PATCH', 'PUT', 'POST', 'DELETE', 'CONNECT', 'TRACE']);
    expect(CSRF_DEFAULT_OPTIONS.type).toBe('double-csrf');
    expect((CSRF_DEFAULT_OPTIONS as Required<CsrfDoubleCsrfOptions>).cookieKey).toBe(DEFAULT_KEY);
    expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).sessionKey).toBe(DEFAULT_KEY);
    expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).oneTimeToken).toBe(false);
    expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).oneTimeTokenTTL).toBeUndefined();
  });

  it('should define cookieOptions with correct defaults', () => {
    expect((CSRF_DEFAULT_OPTIONS as Required<CsrfDoubleCsrfOptions>).cookieOptions).toEqual({
      path: '/',
      secure: false,
      sameSite: 'strict',
      httpOnly: true,
      signed: false,
      maxAge: undefined
    });
  });

  it('should extract token from headers using getToken()', () => {
    const mockReq = {
      headers: {
        [DEFAULT_HEADER_KEY]: 'mock-token'
      }
    };
    const token = CSRF_DEFAULT_OPTIONS.getToken(mockReq);
    expect(token).toBe('mock-token');
  });

  describe('nonceStore', () => {
    it('should set and get nonce values correctly', () => {
      const key = 'nonce-key';
      const value = 'nonce-value';
      (CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.set(key, value);
      expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.get(key)).toBe(value);
    });

    it('should delete nonce values correctly', () => {
      const key = 'to-delete';
      const value = 'some-value';
      (CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.set(key, value);
      (CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.del(key);
      expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.get(key)).toBeUndefined();
    });

    it('should respect ttl when setting nonce (optional)', () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      (CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.set(key, value, 1); // 1 ms
      expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.get(key)).toBe(value);

      return new Promise((resolve) => {
        setTimeout(() => {
          expect((CSRF_DEFAULT_OPTIONS as Required<CsrfSessionOptions>).nonceStore.get(key)).toBeUndefined();
          resolve(undefined);
        }, 10);
      });
    });
  });
});
