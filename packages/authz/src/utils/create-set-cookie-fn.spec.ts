import type { Request, Response } from 'express';
import { createSetCookieFn } from './create-set-cookie-fn';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Create set cookie fn', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let usingSecret: string | undefined;
  let setCookie: ReturnType<typeof createSetCookieFn>;

  beforeEach(() => {
    req = { secret: undefined };
    usingSecret = undefined;
    res = {
      cookie: jest.fn().mockImplementation(() => {
        usingSecret = req.secret;
      })
    };
    setCookie = createSetCookieFn(req as Request, res as Response);
  });

  it('should set an unsigned cookie when no secret', () => {
    req.secret = 'originalSecret';
    setCookie('testCookie', 'testValue');

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', { signed: false });
    expect(req.secret).toBe('originalSecret');
    expect(usingSecret).toBeUndefined();
  });

  it('should set an unsigned cookie when signed option is provided', () => {
    setCookie('testCookie', 'testValue', { signed: true });

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', { signed: true });
    expect(req.secret).toBeUndefined();
    expect(usingSecret).toBeUndefined();
  });

  it('should set a signed cookie when a secret is provided', () => {
    setCookie('testCookie', 'testValue', { secret: 'mySecret' });

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', { signed: true });
    expect(req.secret).toBeUndefined();
    expect(usingSecret).toBe('mySecret');
  });

  it('should respect user signed option even if secret is provided', () => {
    setCookie('testCookie', 'testValue', { secret: 'mySecret', signed: false });

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', { signed: false });
    expect(req.secret).toBeUndefined();
    expect(usingSecret).toBeUndefined();
  });

  it('should restore req.secret after setting a signed cookie', () => {
    req.secret = 'originalSecret';
    setCookie('testCookie', 'testValue', { secret: 'newSecret' });

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', { signed: true });
    expect(req.secret).toBe('originalSecret');
    expect(usingSecret).toBe('newSecret');
  });

  it('should use req.secret to set a signed cookie when no secret is provided', () => {
    req.secret = 'originalSecret';
    setCookie('testCookie', 'testValue', { signed: true });

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', { signed: true });
    expect(req.secret).toBe('originalSecret');
    expect(usingSecret).toBe('originalSecret');
  });

  it('should set a cookie with custom options', () => {
    setCookie('testCookie', 'testValue', { maxAge: 1000, httpOnly: true });

    expect(res.cookie).toHaveBeenCalledWith('testCookie', 'testValue', {
      signed: false,
      maxAge: 1000,
      httpOnly: true
    });
  });
});
