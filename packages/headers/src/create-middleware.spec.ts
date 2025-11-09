import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMiddleware } from './create-middleware';
import type { HeadersModuleOptions } from './types';
import { getReqPath, matchPath } from './utils';

jest.mock('./utils', () => ({
  getReqPath: jest.fn(),
  matchPath: jest.fn()
}));

describe('createMiddleware', () => {
  let req: Partial<IncomingMessage>;
  let res: Partial<ServerResponse>;
  let next: jest.Mock;
  let logger: jest.Mock;

  beforeEach(() => {
    req = { url: '/test/path?foo=1' };
    res = {
      // @ts-ignore
      headers: {},
      setHeader: jest.fn(function (this: any, key: string, value: any) {
        this.headers![key] = value;
        return this;
      }),
      getHeader: jest.fn(function (this: any, key: string) {
        return this.headers![key];
      })
    };
    next = jest.fn();
    logger = jest.fn();

    jest.mocked(getReqPath).mockReturnValue('/test/path');
    jest
      .mocked(matchPath)
      .mockImplementation((pattern: any, path: string) =>
        typeof pattern === 'string' ? path.startsWith(pattern) : pattern.test(path)
      );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip when excluded path matches', async () => {
    const middleware = createMiddleware({
      headers: { 'X-Test': 'a' },
      exclude: ['/test'],
      overwrite: true,
      logger
    } as HeadersModuleOptions & { logger: Function });

    await middleware(req as any, res as any, next);

    expect(logger).toHaveBeenCalledWith(expect.stringContaining('Skipped (excluded): /test/path'));
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should skip when include defined but does not match', async () => {
    const middleware = createMiddleware({
      headers: { 'X-Test': '1' },
      include: ['/other'],
      overwrite: true,
      logger
    } as HeadersModuleOptions & { logger: Function });

    await middleware(req as any, res as any, next);

    expect(logger).toHaveBeenCalledWith(expect.stringContaining('Skipped (not included): /test/path'));
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should set headers normally when path included', async () => {
    const middleware = createMiddleware({
      headers: { 'X-A': '1', 'X-B': '2' },
      include: ['/test'],
      overwrite: true,
      logger
    } as HeadersModuleOptions & { logger: Function });

    await middleware(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-A', '1');
    expect(res.setHeader).toHaveBeenCalledWith('X-B', '2');
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('applied 2'));
    expect(next).toHaveBeenCalled();
  });

  it('should not overwrite existing headers when overwrite=false', async () => {
    jest.mocked(res.getHeader!).mockReturnValue('exists');
    const middleware = createMiddleware({
      headers: { 'X-Test': 'new' },
      include: ['/test'],
      overwrite: false,
      logger
    } as HeadersModuleOptions & { logger: Function });

    await middleware(req as any, res as any, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('applied 0'));
  });

  it('should handle async headers factory', async () => {
    const headersFn = jest.fn(async () => ({ 'X-Dynamic': 'OK' }));
    const middleware = createMiddleware({
      headers: headersFn,
      include: ['/test'],
      overwrite: true,
      logger
    } as HeadersModuleOptions & { logger: Function });

    await middleware(req as any, res as any, next);

    expect(headersFn).toHaveBeenCalledWith(req);
    expect(res.setHeader).toHaveBeenCalledWith('X-Dynamic', 'OK');
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('applied 1'));
  });

  it('should skip null or undefined headers', async () => {
    const middleware = createMiddleware({
      headers: { 'X-Null': null, 'X-Undef': undefined, 'X-Valid': 'yes' },
      include: ['/test'],
      overwrite: true,
      logger
    } as HeadersModuleOptions & { logger: Function });

    await middleware(req as any, res as any, next);

    expect(res.setHeader).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('X-Valid', 'yes');
  });
});
