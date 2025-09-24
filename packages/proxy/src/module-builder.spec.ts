import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigurableModuleClass } from './module-builder';
import { ProxyInterceptor } from './proxy.interceptor';

describe('Module Builder', () => {
  const mockOptions = {
    target: 'http://localhost:3000',
    changeOrigin: true
  };

  it('should export ConfigurableModuleClass with expected factory method', () => {
    expect(ConfigurableModuleClass).toBeDefined();
    expect(typeof ConfigurableModuleClass.register).toBe('function');
    expect(typeof ConfigurableModuleClass.registerAsync).toBe('function');
  });

  it('should not register global interceptor if global is false', () => {
    const module = ConfigurableModuleClass.register({
      options: mockOptions,
      global: false
    });

    expect(module.providers).toBeDefined();
    const appInterceptor = module.providers?.find((p: any) => p.provide === APP_INTERCEPTOR);
    expect(appInterceptor).toBeUndefined();
  });

  it('should register CsrfGuard and ProxyInterceptor globally when global is true', async () => {
    const module = ConfigurableModuleClass.register({
      options: mockOptions,
      global: true
    });

    const appInterceptor = module.providers?.find((p: any) => p.provide === APP_INTERCEPTOR);

    expect(appInterceptor).toBeDefined();
    // @ts-ignore
    expect(appInterceptor?.useClass).toBe(ProxyInterceptor);
  });
});
