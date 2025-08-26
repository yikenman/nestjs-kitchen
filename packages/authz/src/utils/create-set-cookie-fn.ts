import type { RawRequestWithShims, RawResponseWithShims } from './adapter-shim';
import { normalizedArray } from './generics';

// @fastify/cookie does not use req.secret to encrypted.
export const createSetCookieFn =
  (req: RawRequestWithShims, res: RawResponseWithShims) =>
  (name: string, value: string, options: Record<string, any> = {}) => {
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

    res.shims.setCookie(name, value, {
      signed,
      ...restOpts
    });

    req.secret = reqSecret;
  };
