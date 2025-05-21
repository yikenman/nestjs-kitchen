import type { CsrfModuleOptions } from './types';
import { createMemoryStore } from './utils';

export const CSRF_OPTIONS = Symbol('CSRF_OPTIONS');

export const CSRF_INSTANCE = Symbol('CSRF_INSTANCE');

export const CSRF_METADATA_VERIFY = 'csrf:verify';

export const CSRF_METADATA_NO_VERIFY = 'csrf:no-verify';

export const CSRF_METADATA_SIGN = 'csrf:sign';

export const DEFAULT_HEADER_KEY = 'x-csrf-token';

export const DEFAULT_KEY = '_csrf';

export const CSRF_KEY_PREFIX = 'csrf';

const memoryStore = createMemoryStore();

export const CSRF_DEFAULT_OPTIONS = {
  saltLength: 8,
  secretLength: 18,
  getToken: (req) => {
    return req.headers[DEFAULT_HEADER_KEY];
  },
  headerKey: DEFAULT_HEADER_KEY,
  verifyMethods: ['PATCH', 'PUT', 'POST', 'DELETE', 'CONNECT', 'TRACE'],
  type: 'double-csrf',
  cookieKey: DEFAULT_KEY,
  cookieOptions: {
    path: '/',
    secure: false,
    sameSite: 'strict',
    httpOnly: true,
    signed: false,
    maxAge: undefined
  },
  sessionKey: DEFAULT_KEY,
  oneTimeToken: false,
  oneTimeTokenTTL: undefined,
  nonceStore: {
    del: (key: string) => memoryStore.del(key),
    get: (key: string) => memoryStore.get(key),
    set: (key: string, value: string, ttl?: number) => memoryStore.set(key, value, ttl)
  }
} as Required<CsrfModuleOptions>;
