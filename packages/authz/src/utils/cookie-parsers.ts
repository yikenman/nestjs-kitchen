import * as cookie from 'cookie';
import cookieParser from 'cookie-parser';

export const normalCookieParser = (req: any, _secrets: string[] = [], decode?: (str: string) => string | undefined) => {
  let cookies = req.cookies || {};
  let signedCookies = req.signedCookies || {};

  // compatible to @fastify/cookie
  if (typeof req.unsignCookie === 'function') {
    for (const [key, value] of Object.entries(cookies)) {
      const unsigned = req.unsignCookie(value as string);
      if (unsigned.valid) {
        signedCookies[key] = unsigned.value;
      }
    }
  }

  if (!req.cookies && req.headers.cookie) {
    const parsedCookies = cookie.parse(req.headers.cookie, { decode }) as Record<string, string>;
    // cookie-parser uses req.secret to decrypt cookies
    if (req.secret) {
      signedCookies = cookieParser.JSONCookies(
        cookieParser.signedCookies(parsedCookies, [req.secret]) as Record<string, string>
      );
    }
    cookies = cookieParser.JSONCookies(parsedCookies);
  }

  return { cookies, signedCookies };
};

export const customCookieParser = (req: any, secrets: string[] = [], decode?: (str: string) => string | undefined) => {
  let cookies = {};
  let signedCookies = {};

  if (req.headers.cookie) {
    const parsedCookies = cookie.parse(req.headers.cookie, {
      decode
    }) as Record<string, string>;
    if (secrets.length) {
      signedCookies = cookieParser.JSONCookies(
        cookieParser.signedCookies(parsedCookies, secrets) as Record<string, string>
      );
    }
    cookies = cookieParser.JSONCookies(parsedCookies);
  }

  return { cookies, signedCookies };
};
