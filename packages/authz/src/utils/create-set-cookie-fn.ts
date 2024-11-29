import type { Request, Response } from 'express';
import { normalizedArray } from './generics';
import type { CookieOptionsWithSecret } from './types';

export const createSetCookieFn =
  (req: Request, res: Response) =>
  (name: string, value: string, options: CookieOptionsWithSecret = {}) => {
    const { secret, signed: optSigned, ...restOpts } = options;

    const secrets = normalizedArray(secret) ?? [];
    const signed = optSigned ?? Boolean(secrets.length);
    const reqSecret = req.secret;

    if (signed) {
      if (secrets.length) {
        req.secret = secrets[0];
      }
    } else {
      req.secret = undefined;
    }

    res.cookie(name, value, {
      signed,
      ...restOpts
    });

    req.secret = reqSecret;
  };
