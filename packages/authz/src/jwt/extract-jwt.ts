/**
 * fork from https://github.com/mikenicholson/passport-jwt/blob/master/lib/extract_jwt.js
 */
import { parse } from 'node:url';
import type { ParseOptions } from 'cookie';
import type { Request } from 'express';
import { customCookieParser, normalCookieParser, normalizedArray } from '../utils';

const re = /(\S+)\s+(\S+)/;

export const parseAuthHeader = (hdrValue: unknown) => {
  if (typeof hdrValue !== 'string') {
    return null;
  }
  var matches = hdrValue.match(re);
  return matches && { scheme: matches[1], value: matches[2] };
};

const AUTH_HEADER = 'authorization';
const BEARER_AUTH_SCHEME = 'bearer';

export interface JwtFromRequestFunction<T = any> {
  (req: T): string | null;
}

/**
 * Utility factory function for creating extractor functions that retrieve JWT from HTTP requests.
 *
 * Same as `passportjs` [jwt extractors](https://www.passportjs.org/packages/passport-jwt/#included-extractors)
 */
export const ExtractJwt = {
  /**
   * Creates an extractor function to retrieve a token from the request header.
   *
   * @param {string} header_name - The name of the header to extract the token from.
   * @returns {JwtFromRequestFunction} A function that takes a request object and returns the extracted token.
   */
  fromHeader: (header_name: string): JwtFromRequestFunction => {
    return function (request: Request) {
      let token: string | null = null;
      if (request.headers[header_name]) {
        token = request.headers[header_name] as string;
      }
      return token;
    };
  },
  /**
   * Creates an extractor function to retrieve a token from a field in the request body.
   *
   * @param {string} field_name - The name of the field to extract the token from.
   * @returns {JwtFromRequestFunction} A function that takes a request object and returns the extracted token.
   */
  fromBodyField: (field_name: string): JwtFromRequestFunction => {
    return function (request: Request) {
      let token: string | null = null;
      if (request.body && Object.prototype.hasOwnProperty.call(request.body, field_name)) {
        token = request.body[field_name];
      }
      return token;
    };
  },
  /**
   * Creates an extractor function to retrieve a token from a query parameter in the URL.
   *
   * @param {string} param_name - The name of the query parameter to extract the token from.
   * @returns {JwtFromRequestFunction} A function that takes a request object and returns the extracted token.
   */
  fromUrlQueryParameter: (param_name: string): JwtFromRequestFunction => {
    return function (request: Request) {
      let token: string | null = null;
      const parsed_url = parse(request.url, true);
      if (parsed_url.query && Object.prototype.hasOwnProperty.call(parsed_url.query, param_name)) {
        token = parsed_url.query[param_name] as string;
      }
      return token;
    };
  },
  /**
   * Creates an extractor function to retrieve a token from the authorization header with a specific scheme.
   *
   * @param {string} auth_scheme - The authorization scheme (e.g., 'Bearer').
   * @returns {JwtFromRequestFunction} A function that takes a request object and returns the extracted token.
   */
  fromAuthHeaderWithScheme: (auth_scheme: string): JwtFromRequestFunction => {
    var auth_scheme_lower = auth_scheme.toLowerCase();
    return function (request: Request) {
      let token: string | null = null;
      if (request.headers[AUTH_HEADER]) {
        var auth_params = parseAuthHeader(request.headers[AUTH_HEADER]);
        if (auth_params && auth_scheme_lower === auth_params.scheme.toLowerCase()) {
          token = auth_params.value;
        }
      }
      return token;
    };
  },
  /**
   * Creates an extractor function to retrieve a token from the authorization header as a Bearer token.
   *
   * @returns {JwtFromRequestFunction} A function that takes a request object and returns the extracted token.
   */
  fromAuthHeaderAsBearerToken: (): JwtFromRequestFunction => {
    return ExtractJwt.fromAuthHeaderWithScheme(BEARER_AUTH_SCHEME);
  },
  /**
   * Creates an extractor function to retrieve a token from the request header. Respects cookie-parser middleware if applied.
   *
   * @param cookie_name - The name of the cookie to extract the token from.
   * @param options - Options to parse request cookie header.
   * @returns A function that takes a request object and returns the extracted token.
   */
  fromCookies: (
    cookie_name: string,
    options?: {
      /**
       * a string or array used for parsing signed cookies.
       */
      secret?: string | string[];
      /**
       * Extract token from signed cookie. Default to true if secret was provided.
       */
      signed?: boolean;
    } & ParseOptions
  ): JwtFromRequestFunction => {
    const cookie_name_lower = cookie_name.toLowerCase();
    const { secret, decode } = options ?? {};

    const secrets = normalizedArray(secret) ?? [];
    const signed = options?.signed ?? Boolean(secrets.length);
    const targetParser = Boolean(secrets.length) ? customCookieParser : normalCookieParser;

    return (req: Request) => {
      const { cookies, signedCookies } = targetParser(req, secrets, decode);

      let token: string | null = null;
      const targetCookies = signed ? signedCookies : cookies;
      if (targetCookies[cookie_name_lower]) {
        token = targetCookies[cookie_name_lower] as string;
      }
      return token;
    };
  },
  /**
   * Creates an extractor function that combines multiple extractor functions.
   *
   * @param {JwtFromRequestFunction[]} extractors - An array of extractor functions.
   * @returns {JwtFromRequestFunction} A function that takes a request object and returns the extracted token.
   */
  fromExtractors: (extractors: JwtFromRequestFunction[]): JwtFromRequestFunction => {
    if (!Array.isArray(extractors)) {
      throw new TypeError('extractors.fromExtractors expects an array');
    }

    return function (this: unknown, request: Request) {
      let token: string | null = null;
      let index = 0;
      while (!token && index < extractors.length) {
        token = extractors[index].call(this, request);
        index++;
      }
      return token;
    };
  }
};
