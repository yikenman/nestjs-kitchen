import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CsrfInterceptor } from './csrf.interceptor';
import { CsrfModule } from './csrf.module'; // 你定义的模块文件
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './module-builder'; // 按你的导出方式修改路径

describe('Module Builder', () => {
  it('should export ConfigurableModuleClass with expected factory method', () => {
    expect(ConfigurableModuleClass).toBeDefined();
    expect(typeof ConfigurableModuleClass.register).toBe('function');
    expect(typeof ConfigurableModuleClass.registerAsync).toBe('function');
  });

  it('should not register global providers if global is false', () => {
    const module = ConfigurableModuleClass.register({
      type: 'session'
    });

    expect(module.providers).toBeDefined();
    const appGuard = module.providers?.find((p: any) => p.provide === APP_GUARD);
    const appInterceptor = module.providers?.find((p: any) => p.provide === APP_INTERCEPTOR);
    expect(appGuard).toBeUndefined();
    expect(appInterceptor).toBeUndefined();
  });

  it('should register CsrfGuard and CsrfInterceptor globally when global is true', async () => {
    const module = ConfigurableModuleClass.register({
      type: 'session',
      global: true
    });

    const appGuard = module.providers?.find((p: any) => p.provide === APP_GUARD);
    const appInterceptor = module.providers?.find((p: any) => p.provide === APP_INTERCEPTOR);

    expect(appGuard).toBeDefined();
    //@ts-ignore
    expect(appGuard?.useClass).toBe(CsrfGuard);
    expect(appInterceptor).toBeDefined();
    //@ts-ignore
    expect(appInterceptor?.useClass).toBe(CsrfInterceptor);
  });
});
