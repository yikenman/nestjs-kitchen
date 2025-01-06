import { Module } from '@nestjs/common';
import { mixinModule } from './mixin-module';

class MockService {}

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Module: jest.fn(actual.Module)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('mixinModule', () => {
  it('should set the correct name on the mixin class', () => {
    const name = 'MyCustomModule';
    const mixinClass = class extends MockService {};

    const result = mixinModule(name, mixinClass);

    expect(result.name).toBe(name);
  });

  it('should apply the @Module decorator correctly', () => {
    const name = 'MyCustomModule';
    const mixinClass = class extends MockService {};

    const mockModuleFn = jest.fn();
    jest.mocked(Module).mockReturnValue(mockModuleFn);

    mixinModule(name, mixinClass);

    expect(Module).toHaveBeenCalledTimes(1);
    expect(Module).toHaveBeenCalledWith({});

    expect(mockModuleFn).toHaveBeenCalledTimes(1);
    expect(mockModuleFn).toHaveBeenCalledWith(mixinClass);
  });
});
