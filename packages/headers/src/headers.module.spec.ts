import { MiddlewareConsumer } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HeadersModule } from './headers.module';
import type { HeadersModuleOptions } from './types';

describe('HeadersModule - debug', () => {
  let module: TestingModule;
  let consumerMock: MiddlewareConsumer;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        HeadersModule.register({
          headers: { 'X-Test': '123' },
          debug: true
        } as HeadersModuleOptions)
      ]
    }).compile();

    consumerMock = {
      apply: jest.fn().mockReturnThis(),
      forRoutes: jest.fn().mockReturnThis()
    } as unknown as MiddlewareConsumer;
  });

  it('should call consumer.apply with createMiddleware', () => {
    const headersModule = module.get(HeadersModule);

    headersModule.configure(consumerMock);

    expect(consumerMock.apply).toHaveBeenCalledTimes(1);

    const middlewareFn: Function = jest.mocked(consumerMock.apply).mock.calls[0][0];
    expect(typeof middlewareFn).toBe('function');

    // @ts-ignore
    expect(consumerMock.forRoutes).toHaveBeenCalledWith('*');
  });

  it('middleware should set headers correctly', async () => {
    const headersModule = module.get(HeadersModule);

    headersModule.configure(consumerMock);
    const middlewareFn = (consumerMock.apply as jest.Mock).mock.calls[0][0];

    const reqMock = { url: '/foo' } as any;
    const setHeaderMock = jest.fn();
    const getHeaderMock = jest.fn().mockReturnValue(undefined);
    const resMock = { setHeader: setHeaderMock, getHeader: getHeaderMock } as any;
    const nextMock = jest.fn();

    await middlewareFn(reqMock, resMock, nextMock);

    expect(setHeaderMock).toHaveBeenCalledWith('X-Test', '123');
    expect(nextMock).toHaveBeenCalled();
  });
});

describe('HeadersModule', () => {
  let module: TestingModule;
  let consumerMock: MiddlewareConsumer;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        HeadersModule.register({
          headers: { 'X-Test': '123' },
          debug: false
        } as HeadersModuleOptions)
      ]
    }).compile();

    consumerMock = {
      apply: jest.fn().mockReturnThis(),
      forRoutes: jest.fn().mockReturnThis()
    } as unknown as MiddlewareConsumer;
  });

  it('should call consumer.apply with createMiddleware using noop logger', async () => {
    const headersModule = module.get(HeadersModule);

    headersModule.configure(consumerMock);

    expect(consumerMock.apply).toHaveBeenCalledTimes(1);

    const middlewareFn: Function = jest.mocked(consumerMock.apply).mock.calls[0][0];
    expect(typeof middlewareFn).toBe('function');

    const reqMock = { url: '/foo' } as any;
    const resMock = {
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue(undefined)
    } as any;
    const nextMock = jest.fn();

    await middlewareFn(reqMock, resMock, nextMock);

    expect(resMock.setHeader).toHaveBeenCalledWith('X-Test', '123');

    expect(nextMock).toHaveBeenCalled();
  });
});
