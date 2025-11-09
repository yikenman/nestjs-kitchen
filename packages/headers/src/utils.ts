import type { IncomingMessage } from 'node:http';

export const matchPath = (pattern: string | RegExp, path: string) => {
  return typeof pattern === 'string' ? path.startsWith(pattern) : pattern.test(path);
};

export const noop = () => {};

export const getReqPath = (req: IncomingMessage): string => {
  return req.url?.split('?')[0] || '/';
};
