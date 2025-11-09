import { ConfigurableModuleBuilder } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ASYNC_OPTIONS_TYPE, ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } from './module-builder';
import type { HeadersModuleOptions } from './types';

describe('HeadersModule (ConfigurableModuleBuilder)', () => {
  it('should export all required tokens', () => {
    expect(MODULE_OPTIONS_TOKEN).toBeDefined();
    expect(ASYNC_OPTIONS_TYPE).toBeDefined();
    expect(OPTIONS_TYPE).toBeDefined();
  });

  it('should create a configurable module class', () => {
    expect(ConfigurableModuleClass).toBeDefined();
    expect(typeof ConfigurableModuleClass).toBe('function');
  });

  it('should have static forRoot and forRootAsync methods', () => {
    expect(typeof ConfigurableModuleClass.register).toBe('function');
    expect(typeof ConfigurableModuleClass.registerAsync).toBe('function');
  });

  it('should register module with provided options via forRoot', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        (ConfigurableModuleClass as any).register({
          headers: { 'X-Test': 'OK' }
        } satisfies HeadersModuleOptions)
      ]
    }).compile();

    const options = moduleRef.get<HeadersModuleOptions>(MODULE_OPTIONS_TOKEN);
    expect(options).toEqual({ headers: { 'X-Test': 'OK' } });
  });

  it('should register module with async options via forRootAsync', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        (ConfigurableModuleClass as any).registerAsync({
          useFactory: async () => ({
            headers: { 'X-Async': 'Done' }
          })
        })
      ]
    }).compile();

    const options = moduleRef.get<HeadersModuleOptions>(MODULE_OPTIONS_TOKEN);
    expect(options).toEqual({ headers: { 'X-Async': 'Done' } });
  });
});
