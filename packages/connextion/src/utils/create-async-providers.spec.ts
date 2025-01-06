import * as funs from './create-async-providers';
import type { AsyncConnectionOptions } from './types';

class MockClass {
  createConnectionOptions() {
    return {};
  }
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('asyncOptionsProviderFactory', () => {
  it('should call createConnectionOptions method', () => {
    const createConnectionOptions = jest.fn();
    funs.asyncOptionsProviderFactory({ createConnectionOptions });

    expect(createConnectionOptions).toHaveBeenCalledTimes(1);
  });
});

describe('createAsyncOptionsProvider', () => {
  it('should return a provider with useFactory & inject when useFactory is provided', () => {
    const mockUseFactory = jest.fn().mockResolvedValue('mockedOption');
    const options: AsyncConnectionOptions<unknown, unknown> = {
      useFactory: mockUseFactory,
      inject: ['someService']
    };

    const result = funs.createAsyncOptionsProvider('someToken', options);

    expect(result).toEqual({
      provide: 'someToken',
      useFactory: mockUseFactory,
      inject: ['someService']
    });
  });

  it('should return a provider with useFactory when useFactory is provided', () => {
    const mockUseFactory = jest.fn().mockResolvedValue('mockedOption');
    const options: AsyncConnectionOptions<unknown, unknown> = {
      useFactory: mockUseFactory
    };

    const result = funs.createAsyncOptionsProvider('someToken', options);

    expect(result).toEqual({
      provide: 'someToken',
      useFactory: mockUseFactory,
      inject: []
    });
  });

  it('should return a provider with useFactory when useExisting is provided', () => {
    const options: AsyncConnectionOptions<unknown, unknown> = {
      useExisting: MockClass
    };

    const result = funs.createAsyncOptionsProvider('someToken', options);

    expect(result).toEqual({
      provide: 'someToken',
      useFactory: funs.asyncOptionsProviderFactory,
      inject: [MockClass]
    });
  });

  it('should return a provider with useFactory when useClass is provided', () => {
    const options: AsyncConnectionOptions<unknown, unknown> = {
      useClass: MockClass
    };

    const result = funs.createAsyncOptionsProvider('someToken', options);

    expect(result).toEqual({
      provide: 'someToken',
      useFactory: funs.asyncOptionsProviderFactory,
      inject: [MockClass]
    });
  });
});

describe('createAsyncProviders', () => {
  it('should return an array with one provider when useExisting or useFactory is provided', () => {
    const options: AsyncConnectionOptions<unknown, unknown> = {
      useFactory: jest.fn(),
      inject: ['someService']
    };

    const spy = jest.spyOn(funs, 'createAsyncOptionsProvider');

    const result = funs.createAsyncProviders('someToken', options);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('someToken', options);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      provide: 'someToken',
      useFactory: options.useFactory,
      inject: ['someService']
    });
  });

  it('should return an array with two providers when useClass is provided', () => {
    const options: AsyncConnectionOptions<unknown, unknown> = {
      useClass: MockClass
    };

    const spy = jest.spyOn(funs, 'createAsyncOptionsProvider');

    const result = funs.createAsyncProviders('someToken', options);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('someToken', options);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      provide: 'someToken',
      useFactory: funs.asyncOptionsProviderFactory,
      inject: [MockClass]
    });
    expect(result[1]).toEqual({
      provide: MockClass,
      useClass: MockClass
    });
  });

  it('should handle a missing useClass correctly when not provided', () => {
    const options: AsyncConnectionOptions<unknown, unknown> = {};

    const result = funs.createAsyncProviders('someToken', options);

    expect(result).toEqual([
      { inject: [undefined], provide: 'someToken', useFactory: funs.asyncOptionsProviderFactory },
      { provide: undefined, useClass: undefined }
    ]);
  });
});
