import { Module } from '@nestjs/common';
import { uid } from 'uid';
import { mixinModule } from './mixin-module';

class MockService {}

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Module: jest.fn(actual.Module)
  };
});

jest.mock('uid', () => {
  const actual = jest.requireActual('uid');
  return {
    uid: jest.fn(actual.uid)
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

    const result = mixinModule(mixinClass);

    expect(uid).toHaveBeenCalledWith(21);
    expect(result.name).toBe(jest.mocked(uid).mock.results[0].value);
  });

  it('should apply the @Module decorator correctly', () => {
    const name = 'MyCustomModule';
    const mixinClass = class extends MockService {};

    const mockModuleFn = jest.fn();
    jest.mocked(Module).mockReturnValue(mockModuleFn);

    mixinModule(mixinClass);

    expect(Module).toHaveBeenCalledTimes(1);
    expect(Module).toHaveBeenCalledWith({});

    expect(mockModuleFn).toHaveBeenCalledTimes(1);
    expect(mockModuleFn).toHaveBeenCalledWith(mixinClass);
  });
});
