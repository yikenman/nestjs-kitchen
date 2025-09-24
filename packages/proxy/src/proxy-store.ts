import type { createProxyMiddleware } from 'http-proxy-middleware';

export const proxyStore = new WeakMap<object, ReturnType<typeof createProxyMiddleware>>();
