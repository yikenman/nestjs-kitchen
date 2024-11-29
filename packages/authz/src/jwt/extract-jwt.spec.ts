import { customCookieParser, normalCookieParser, normalizedArray } from '../utils';
/**
 * fork from https://github.com/mikenicholson/passport-jwt/blob/master/test/extractors-test.js
 */
import { ExtractJwt, parseAuthHeader } from './extract-jwt';

function Request() {
  this.method = 'GET';
  this.url = '/';
  this.headers = {};
}

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');

  return {
    ...actual,
    customCookieParser: jest.fn(actual.customCookieParser),
    normalCookieParser: jest.fn(actual.normalCookieParser),
    normalizedArray: jest.fn(actual.normalizedArray)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Extract Jwt', () => {
  describe('parseAuthHeader', function () {
    it('should handle single space separated values', function () {
      var res = parseAuthHeader('SCHEME VALUE');
      expect(res).toStrictEqual({ scheme: 'SCHEME', value: 'VALUE' });
    });

    it('should handle CRLF separator', function () {
      var res = parseAuthHeader('SCHEME\nVALUE');
      expect(res).toStrictEqual({ scheme: 'SCHEME', value: 'VALUE' });
    });

    it('should handle malformed authentication headers with no scheme', function () {
      var res = parseAuthHeader('malformed');
      expect(res).toBeDefined();
    });

    it('should return null when the auth header is not a string', function () {
      var res = parseAuthHeader({});
      expect(res).toBeNull();
    });
  });

  describe('Extractjwt', () => {
    describe('fromHeader', () => {
      const extractor = ExtractJwt.fromHeader('test_header');

      it('should return null no when token is present', () => {
        const req = new Request();

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return the value from the specified header', () => {
        const req = new Request();
        req.headers['test_header'] = 'abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });
    });

    describe('fromBodyField', () => {
      const extractor = ExtractJwt.fromBodyField('test_field');

      it('should return null when no body is present', () => {
        const req = new Request();

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return null when the specified body field is not present', () => {
        const req = new Request();
        req.body = {};

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return the value from the specified body field', () => {
        const req = new Request();
        req.body = {};
        req.body.test_field = 'abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });

      it('should work properly with querystring', () => {
        const req = new Request();
        const querystring = require('querystring');
        req.body = querystring.parse('test_field=abcd123');

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });
    });

    describe('fromUrlQueryParameter', () => {
      const extractor = ExtractJwt.fromUrlQueryParameter('test_param');

      it('should return null when the specified paramter is not present', () => {
        const req = new Request();

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return the value from the specified parameter', () => {
        const req = new Request();
        req.url += '?test_param=abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });
    });

    describe('fromAuthHeaderWithScheme', () => {
      const extractor = ExtractJwt.fromAuthHeaderWithScheme('TEST_SCHEME');

      it('should return null when no auth header is present', () => {
        const req = new Request();

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return null when the auth header is present but the auth scheme doesnt match', () => {
        const req = new Request();
        req.headers['authorization'] = 'NOT_TEST_SCHEME abcd123';

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return the value from the authorization header with specified auth scheme', () => {
        const req = new Request();
        req.headers['authorization'] = 'TEST_SCHEME abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });

      it('should perform a case-insensivite string comparison', () => {
        const req = new Request();
        req.headers['authorization'] = 'test_scheme abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });
    });

    describe('fromAuthHeader', () => {
      const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();

      it('should return the value from the authorization header with default JWT auth scheme', () => {
        const req = new Request();
        req.headers['authorization'] = 'bearer abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });
    });

    describe('fromCookies', () => {
      const mockCookieName = 'authToken';
      const mockSignedCookieName = 'signedAuthToken';
      const mockToken = 'mockJwtToken';
      const mockSignedToken = 'mockSignedJwtToken';

      const req = {} as unknown as Request;

      beforeEach(() => {
        jest.mocked(normalCookieParser).mockImplementation(() => ({
          cookies: { [mockCookieName.toLowerCase()]: mockToken },
          signedCookies: { [mockSignedCookieName.toLowerCase()]: mockSignedToken }
        }));

        jest.mocked(customCookieParser).mockImplementation(() => ({
          cookies: { [mockCookieName.toLowerCase()]: mockToken },
          signedCookies: { [mockSignedCookieName.toLowerCase()]: mockSignedToken }
        }));
      });

      it('should extract token from unsigned cookie when no secret is provided', () => {
        const extractJwt = ExtractJwt.fromCookies(mockCookieName);
        expect(extractJwt(req)).toBe(mockToken);
        expect(normalCookieParser).toHaveBeenCalledTimes(1);
        expect(normalCookieParser).toHaveBeenCalledWith(req, [], undefined);
      });

      it('should extract token from signed cookie when secret is provided', () => {
        const extractJwt = ExtractJwt.fromCookies(mockSignedCookieName, { secret: 'mySecret' });
        expect(normalizedArray).toHaveBeenCalledTimes(1);
        expect(normalizedArray).toHaveBeenCalledWith('mySecret');
        expect(extractJwt(req)).toBe(mockSignedToken);
        expect(customCookieParser).toHaveBeenCalledTimes(1);
        expect(customCookieParser).toHaveBeenCalledWith(req, ['mySecret'], undefined);
      });

      it('should extract token from signed cookie when secret array is provided', () => {
        const extractJwt = ExtractJwt.fromCookies(mockSignedCookieName, { secret: ['mySecret1', 'mySecret2'] });
        expect(normalizedArray).toHaveBeenCalledTimes(1);
        expect(normalizedArray).toHaveBeenCalledWith(['mySecret1', 'mySecret2']);
        expect(extractJwt(req)).toBe(mockSignedToken);
        expect(customCookieParser).toHaveBeenCalledTimes(1);
        expect(customCookieParser).toHaveBeenCalledWith(req, ['mySecret1', 'mySecret2'], undefined);
      });

      it('should return null if cookie name is not found', () => {
        const extractJwt = ExtractJwt.fromCookies('nonExistingCookie');
        expect(extractJwt(req)).toBeNull();
      });

      it('should respect signed option when explicitly set to false', () => {
        const extractJwt = ExtractJwt.fromCookies(mockCookieName, { secret: 'mySecret', signed: false });
        expect(extractJwt(req)).toBe(mockToken);
      });

      it('should use `decode` function if provided', () => {
        const decode = jest.fn().mockImplementation((str) => str);

        ExtractJwt.fromCookies(mockCookieName, { decode })(req);
        expect(normalCookieParser).toHaveBeenCalledWith(req, [], decode);

        ExtractJwt.fromCookies(mockCookieName, { decode, secret: 'mySecret' })(req);
        expect(customCookieParser).toHaveBeenCalledWith(req, ['mySecret'], decode);
      });
    });

    describe('fromExtractors', () => {
      it('should raise a type error when the extractor is constructed with a non-array argument', () => {
        expect(() => ExtractJwt.fromExtractors({} as any)).toThrow(TypeError);
      });

      const extractor = ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromHeader('authorization')
      ]);

      it('should return null when no extractor extracts token', () => {
        const req = new Request();

        const token = extractor(req);

        expect(token).toBeNull();
      });

      it('should return token found by least extractor', () => {
        const req = new Request();
        req.headers['authorization'] = 'abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });

      it('should return token found by first extractor', () => {
        const req = new Request();
        req.headers['authorization'] = 'bearer abcd123';

        const token = extractor(req);

        expect(token).toEqual('abcd123');
      });
    });
  });
});
