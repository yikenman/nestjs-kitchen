import { getAdaptorMethods } from './get-adaptor-methods';

describe('getAdaptorMethods', () => {
  describe('ExpressAdapter', () => {
    const methods = getAdaptorMethods('ExpressAdapter');
    const req: any = {
      session: { id: 'sess123', foo: 'bar' },
      cookies: { a: '1' },
      signedCookies: { a: '2' },
      method: 'POST'
    };
    const res: any = {
      cookie: jest.fn(),
      set: jest.fn()
    };

    it('should get session', () => {
      expect(methods.getSession(req, 'foo')).toBe('bar');
    });

    it('should get session id', () => {
      expect(methods.getSessionId(req)).toBe('sess123');
    });

    it('should set session', () => {
      methods.setSession(req, 'test', 'ok');
      expect(req.session.test).toBe('ok');
    });

    it('should check session availability', () => {
      expect(methods.isSessionAvailable(req)).toBe(true);
    });

    it('should get signed cookie by default', () => {
      expect(methods.getCookie(req, 'a')).toBe('2');
    });

    it('should get unsigned cookie if signed=false', () => {
      expect(methods.getCookie(req, 'a', false)).toBe('1');
    });

    it('should set cookie', () => {
      methods.setCookie(res, 'k', 'v', { httpOnly: true });
      expect(res.cookie).toHaveBeenCalledWith('k', 'v', { httpOnly: true });
    });

    it('should check cookie availability', () => {
      expect(methods.isCookieAvailable(req)).toBe(true);
    });

    it('should set header', () => {
      methods.setHeader(res, 'X-Test', '123');
      expect(res.set).toHaveBeenCalledWith('X-Test', '123');
    });

    it('should get http method', () => {
      expect(methods.getHttpMethod(req)).toBe('POST');
    });
  });

  describe('FastifyAdapter', () => {
    const get = jest.fn().mockImplementation((k) => (k === 'foo' ? 'bar' : undefined));
    const set = jest.fn();
    const unsignCookie = jest.fn().mockReturnValue({ value: 'unsigned' });

    const req: any = {
      session: { get, set, sessionId: 'fast123' },
      cookies: { a: 'value' },
      unsignCookie,
      method: 'GET'
    };
    const res: any = {
      setCookie: jest.fn(),
      header: jest.fn()
    };

    const methods = getAdaptorMethods('FastifyAdapter');

    it('should get session', () => {
      expect(methods.getSession(req, 'foo')).toBe('bar');
    });

    it('should get session id', () => {
      expect(methods.getSessionId(req)).toBe('fast123');
    });

    it('should set session', () => {
      methods.setSession(req, 'key', 'val');
      expect(set).toHaveBeenCalledWith('key', 'val');
    });

    it('should check session availability', () => {
      expect(methods.isSessionAvailable(req)).toBe(true);
    });

    it('should get signed cookie by default using unsignCookie', () => {
      expect(methods.getCookie(req, 'a')).toBe('unsigned');
    });

    it('should get raw cookie if signed = false', () => {
      expect(methods.getCookie(req, 'a', false)).toBe('value');
    });

    it('should set cookie', () => {
      methods.setCookie(res, 'key', 'val', { path: '/' });
      expect(res.setCookie).toHaveBeenCalledWith('key', 'val', { path: '/' });
    });

    it('should check cookie availability', () => {
      expect(methods.isCookieAvailable(req)).toBe(true);
    });

    it('should set header', () => {
      methods.setHeader(res, 'X-Header', 'Val');
      expect(res.header).toHaveBeenCalledWith('X-Header', 'Val');
    });

    it('should get http method', () => {
      expect(methods.getHttpMethod(req)).toBe('GET');
    });
  });

  it('should return undefined for unknown adapter', () => {
    expect(getAdaptorMethods('UnknownAdapter')).toBeUndefined();
  });
});
