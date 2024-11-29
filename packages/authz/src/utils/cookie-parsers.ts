import * as cookie from 'cookie';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';

export const normalCookieParser = (
  req: Request,
  _secrets: string[] = [],
  decode?: (str: string) => string | undefined
) => {
  let cookies: typeof req.cookies = req.cookies || {};
  let signedCookies: typeof req.signedCookies = req.signedCookies || {};

  if (!req.cookies && req.headers.cookie) {
    const parsedCookies = cookie.parse(req.headers.cookie, { decode }) as Record<string, string>;
    if (req.secret) {
      signedCookies = cookieParser.JSONCookies(
        cookieParser.signedCookies(parsedCookies, [req.secret]) as Record<string, string>
      );
    }
    cookies = cookieParser.JSONCookies(parsedCookies);
  }

  return { cookies, signedCookies };
};

export const customCookieParser = (
  req: Request,
  secrets: string[] = [],
  decode?: (str: string) => string | undefined
) => {
  let cookies: typeof req.cookies = {};
  let signedCookies: typeof req.signedCookies = {};

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
