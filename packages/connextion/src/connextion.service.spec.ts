import { ModuleRef } from '@nestjs/core';
import { createConnextionService } from './connextion.service';
import { joinStrs } from './utils';

// Mocking ModuleRef and its get method
jest.mock('@nestjs/core', () => {
  const actual = jest.requireActual('@nestjs/core');
  return {
    ...actual,
    ModuleRef: jest.fn().mockImplementation(() => ({
      get: jest.fn()
    }))
  };
});

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    joinStrs: jest.fn(actual.joinStrs)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('createConnextionService', () => {
  let moduleRef: ModuleRef;
  let ConnextionService: ReturnType<typeof createConnextionService>;
  const instanceTokens = {
    someService: 'someServiceToken',
    nonExistentService: 'nonExistentServiceToken'
  };

  beforeEach(async () => {
    // @ts-ignore
    moduleRef = new ModuleRef();
    ConnextionService = createConnextionService<'test', unknown>();
  });

  it('should create the Connextion service', () => {
    expect(ConnextionService).toBeDefined();
  });

  it('should not call getInjectedInstance when accessing an undefined property', () => {
    const instance = new ConnextionService('token', instanceTokens, moduleRef);
    const prop = 'otherService';

    const result = instance[prop];

    expect(result).toBe(undefined);
    expect(moduleRef.get).not.toHaveBeenCalled();
  });

  it('should cache the service instance', () => {
    const instance = new ConnextionService('token', instanceTokens, moduleRef);
    const prop = 'someService';

    const mockedService = { someMethod: jest.fn() };
    jest.mocked(moduleRef).get.mockReturnValue(mockedService);

    // Accessing the undefined property once
    const firstCall = instance[prop];
    const secondCall = instance[prop];

    expect(firstCall).toBe(mockedService);
    expect(secondCall).toBe(mockedService);
    expect(moduleRef.get).toHaveBeenCalledTimes(1); // Should only call once for caching
  });

  it('should throw an error when service not found', () => {
    const instance = new ConnextionService('token', instanceTokens, moduleRef);
    const prop = 'nonExistentService';

    jest.mocked(moduleRef).get.mockImplementation(() => {
      throw new Error('Service not found');
    });

    // Accessing the undefined property should throw an error
    expect(() => instance[prop]).toThrow(`Service with name ${instanceTokens[prop]} not found`);
  });

  it('should return undefined when accessing properties defined in preserveProps', () => {
    const instance = new ConnextionService('token', moduleRef);

    // Accessing preserveProps should return undefined
    const preserveProperties = [
      'beforeApplicationShutdown',
      'onApplicationBootstrap',
      'onApplicationShutdown',
      'onModuleDestroy',
      'onModuleInit',
      'then'
    ];

    preserveProperties.forEach((prop) => {
      expect(instance[prop]).toBeUndefined();
    });
  });

  it('should not be able to access properties defined in forbiddenProps', () => {
    const instance = new ConnextionService('token', moduleRef);

    const forbiddenProps = ['_cache', '_injectTokenId', '_moduleRef', '_getInjectedInstance'];

    forbiddenProps.forEach((prop) => {
      expect(instance[prop]).toBeUndefined();
    });
  });

  it('should be able to access properties defined in ConnextionService', () => {
    const instance = new ConnextionService('token', moduleRef);

    instance.accessableProp = true;

    expect(instance['accessableProp']).toBe(true);
  });
});
