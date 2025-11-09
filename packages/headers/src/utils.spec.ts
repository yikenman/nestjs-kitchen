import type { IncomingMessage } from 'node:http';
import { getReqPath, matchPath, noop } from './utils';

describe('matchPath', () => {
  it('should match path when pattern is a string prefix', () => {
    expect(matchPath('/api', '/api/users')).toBe(true);
    expect(matchPath('/static', '/static/js/app.js')).toBe(true);
  });

  it('should not match when string pattern is not prefix', () => {
    expect(matchPath('/api', '/v1/api')).toBe(false);
    expect(matchPath('/app', '/api/app')).toBe(false);
  });

  it('should match when pattern is a RegExp that passes test', () => {
    expect(matchPath(/^\/api/, '/api/test')).toBe(true);
    expect(matchPath(/\.js$/, '/scripts/main.js')).toBe(true);
  });

  it('should not match when RegExp does not match', () => {
    expect(matchPath(/^\/static/, '/api/test')).toBe(false);
    expect(matchPath(/\.css$/, '/scripts/main.js')).toBe(false);
  });
});

describe('noop', () => {
  it('should be a function and do nothing', () => {
    expect(typeof noop).toBe('function');
    expect(noop()).toBeUndefined();
  });

  it('should not throw when called multiple times', () => {
    expect(() => {
      noop();
      noop();
    }).not.toThrow();
  });
});

describe('getReqPath', () => {
  it('should return path without query string', () => {
    const req = { url: '/test/path?foo=bar&x=1' } as IncomingMessage;
    expect(getReqPath(req)).toBe('/test/path');
  });

  it('should return path when no query string', () => {
    const req = { url: '/simple/path' } as IncomingMessage;
    expect(getReqPath(req)).toBe('/simple/path');
  });

  it('should return "/" when url is undefined', () => {
    const req = { url: undefined } as IncomingMessage;
    expect(getReqPath(req)).toBe('/');
  });

  it('should handle url with only "?"', () => {
    const req = { url: '/justpath?' } as IncomingMessage;
    expect(getReqPath(req)).toBe('/justpath');
  });

  it('should handle url that is just "?"', () => {
    const req = { url: '?' } as IncomingMessage;
    expect(getReqPath(req)).toBe('/');
  });
});
