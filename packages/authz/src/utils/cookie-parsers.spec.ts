import * as cookie from 'cookie';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import { customCookieParser, normalCookieParser } from './cookie-parsers';

jest.mock('Cookie', () => {
  const actual = jest.requireActual('cookie');

  return {
    ...actual,
    parse: jest.fn(actual.parse)
  };
});

jest.mock('cookie-parser', () => {
  const actual = jest.requireActual('cookie-parser');

  return {
    ...actual,
    JSONCookies: jest.fn(actual.JSONCookies),
    signedCookies: jest.fn(actual.signedCookies)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Cookie Parsers', () => {
  let req: Request;

  const reqCookies = {
    name: 'value'
  };
  const reqSignedCookies = {
    signed: 'hello'
  };
  const reqSecret = 'tobiiscool';

  // hello -> hello.DGDUkGlIkCzPz+C0B064FNgHdEjox7ch8tOBGslZ5QI
  const signedValue = 's:hello.DGDUkGlIkCzPz+C0B064FNgHdEjox7ch8tOBGslZ5QI';
  const reqCookie = `name=value; signed=${signedValue}`;

  beforeEach(() => {
    req = {
      headers: {
        cookie: undefined
      },
      cookies: undefined,
      signedCookies: undefined,
      secret: undefined
    } as unknown as Request;
  });

  describe('normalCookieParser', () => {
    it('should return empty objects when no headers.cookie', () => {
      const parsed = normalCookieParser(req);

      expect(cookie.parse).not.toHaveBeenCalled();
      expect(cookieParser.signedCookies).not.toHaveBeenCalled();
      expect(cookieParser.JSONCookies).not.toHaveBeenCalled();

      expect(parsed.cookies).toEqual({});
      expect(parsed.signedCookies).toEqual({});
    });

    it('should only parse cookies from headers.cookie when no secret', () => {
      req.headers.cookie = reqCookie;

      const parsed = normalCookieParser(req);

      expect(cookie.parse).toHaveBeenCalledTimes(1);
      expect(cookie.parse).toHaveBeenCalledWith(reqCookie, { decode: undefined });

      expect(cookieParser.signedCookies).not.toHaveBeenCalled();

      expect(cookieParser.JSONCookies).toHaveBeenCalledTimes(1);
      expect(cookieParser.JSONCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value);

      expect(parsed.cookies).toEqual({ ...reqCookies, signed: signedValue });
      expect(parsed.signedCookies).toEqual({});
    });

    it('should parse cookies and signedCookies from headers.cookie when having secret', () => {
      req.headers.cookie = reqCookie;
      req.secret = reqSecret;

      const parsed = normalCookieParser(req);

      expect(cookie.parse).toHaveBeenCalledTimes(1);
      expect(cookie.parse).toHaveBeenCalledWith(reqCookie, { decode: undefined });

      expect(cookieParser.signedCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value, [
        reqSecret
      ]);
      expect(cookieParser.signedCookies).toHaveBeenCalledTimes(1);
      expect(cookieParser.JSONCookies).toHaveBeenCalledWith(
        jest.mocked(cookieParser.signedCookies).mock.results[0].value
      );

      expect(cookieParser.JSONCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value);
      expect(cookieParser.JSONCookies).toHaveBeenCalledTimes(2);
      expect(parsed.cookies).toEqual(reqCookies);
      expect(parsed.signedCookies).toEqual(reqSignedCookies);
    });

    it('should also respect cookieParser middleware', () => {
      req.headers.cookie = reqCookie;
      req.secret = reqSecret;
      req.cookies = {
        other: 'value'
      };
      req.signedCookies = {
        signed: 'otherValue'
      };

      const parsed = normalCookieParser(req);

      expect(cookie.parse).not.toHaveBeenCalled();
      expect(cookieParser.signedCookies).not.toHaveBeenCalled();
      expect(cookieParser.JSONCookies).not.toHaveBeenCalled();

      expect(parsed.cookies).toEqual(req.cookies);
      expect(parsed.signedCookies).toEqual(req.signedCookies);
    });

    it('should not use _secrets parameter when provided', () => {
      req.headers.cookie = reqCookie;
      req.secret = reqSecret;

      normalCookieParser(req, [reqSecret + '1']);

      expect(cookieParser.signedCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value, [
        reqSecret
      ]);
    });

    it('should use decode parameter when provided', () => {
      req.headers.cookie = reqCookie;
      req.secret = reqSecret;

      const decode = jest.fn((val) => val);
      normalCookieParser(req, [], decode);

      expect(cookie.parse).toHaveBeenCalledTimes(1);
      expect(cookie.parse).toHaveBeenCalledWith(reqCookie, { decode });
      expect(decode).toHaveBeenCalled();
    });
  });

  describe('customCookieParser', () => {
    it('should return empty objects when no headers.cookie', () => {
      const parsed = customCookieParser(req);

      expect(cookie.parse).not.toHaveBeenCalled();
      expect(cookieParser.signedCookies).not.toHaveBeenCalled();
      expect(cookieParser.JSONCookies).not.toHaveBeenCalled();

      expect(parsed.cookies).toEqual({});
      expect(parsed.signedCookies).toEqual({});
    });

    it('should only parse cookies from headers.cookie when no secret', () => {
      req.headers.cookie = reqCookie;

      const parsed = customCookieParser(req);

      expect(cookie.parse).toHaveBeenCalledTimes(1);
      expect(cookie.parse).toHaveBeenCalledWith(reqCookie, { decode: undefined });

      expect(cookieParser.signedCookies).not.toHaveBeenCalled();

      expect(cookieParser.JSONCookies).toHaveBeenCalledTimes(1);
      expect(cookieParser.JSONCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value);

      expect(parsed.cookies).toEqual({ ...reqCookies, signed: signedValue });
      expect(parsed.signedCookies).toEqual({});
    });

    it('should parse cookies and signedCookies from headers.cookie when having secret', () => {
      req.headers.cookie = reqCookie;

      const parsed = customCookieParser(req, [reqSecret]);

      expect(cookie.parse).toHaveBeenCalledTimes(1);
      expect(cookie.parse).toHaveBeenCalledWith(reqCookie, { decode: undefined });

      expect(cookieParser.signedCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value, [
        reqSecret
      ]);
      expect(cookieParser.signedCookies).toHaveBeenCalledTimes(1);
      expect(cookieParser.JSONCookies).toHaveBeenCalledWith(
        jest.mocked(cookieParser.signedCookies).mock.results[0].value
      );

      expect(cookieParser.JSONCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value);
      expect(cookieParser.JSONCookies).toHaveBeenCalledTimes(2);
      expect(parsed.cookies).toEqual(reqCookies);
      expect(parsed.signedCookies).toEqual(reqSignedCookies);
    });

    it('should not respect cookieParser middleware', () => {
      req.headers.cookie = reqCookie;
      req.secret = reqSecret;
      req.cookies = {
        other: 'value'
      };
      req.signedCookies = {
        signed: 'otherValue'
      };

      const parsed = customCookieParser(req, [reqSecret]);

      expect(parsed.cookies).toEqual(reqCookies);
      expect(parsed.signedCookies).toEqual(reqSignedCookies);
    });

    it('should not respect headers.secret', () => {
      req.headers.cookie = reqCookie;
      req.secret = '123456';

      const parsed = customCookieParser(req, [reqSecret]);

      expect(cookieParser.signedCookies).toHaveBeenCalledWith(jest.mocked(cookie.parse).mock.results[0].value, [
        reqSecret
      ]);

      expect(parsed.cookies).toEqual(reqCookies);
      expect(parsed.signedCookies).toEqual(reqSignedCookies);
    });

    it('should use decode parameter when provided', () => {
      req.headers.cookie = reqCookie;

      const decode = jest.fn((val) => val);
      customCookieParser(req, [reqSecret], decode);

      expect(cookie.parse).toHaveBeenCalledTimes(1);
      expect(cookie.parse).toHaveBeenCalledWith(reqCookie, { decode });
      expect(decode).toHaveBeenCalled();
    });
  });
});
