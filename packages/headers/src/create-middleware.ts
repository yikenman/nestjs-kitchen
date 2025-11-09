import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HeadersModuleOptions } from './types';
import { getReqPath, matchPath } from './utils';

export const createMiddleware = (
  options: HeadersModuleOptions & {
    logger: Function;
  }
) => {
  const { headers, include, exclude, overwrite, logger } = options;

  return async (req: IncomingMessage, res: ServerResponse, next: Function) => {
    const path = getReqPath(req);

    if (exclude?.some((p) => matchPath(p, path))) {
      logger(`Skipped (excluded): ${path}`);
      return next();
    }

    if (include && !include.some((p) => matchPath(p, path))) {
      logger(`Skipped (not included): ${path}`);
      return next();
    }

    const computed = Object.entries(typeof headers === 'function' ? await headers(req) : headers);
    let appliedCount = 0;

    computed.forEach(([key, value]) => {
      if (value === null || value === undefined) {
        return;
      }
      if (!overwrite && res.getHeader(key)) {
        return;
      }
      res.setHeader(key, value);
      appliedCount++;
    });

    logger(`Set ${computed.length} header(s), applied ${appliedCount} on ${path}`);

    next();
  };
};
