import { SetMetadata } from '@nestjs/common';
import { CSRF_METADATA_NO_VERIFY, CSRF_METADATA_SIGN, CSRF_METADATA_VERIFY } from './constants';
import { Csrf } from './csrf.decorator';

jest.mock('@nestjs/common', () => {
  const original = jest.requireActual('@nestjs/common');
  return {
    ...original,
    SetMetadata: jest.fn(() => () => {})
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Csrf Decorator', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Csrf() should set CSRF_METADATA_VERIFY = true', () => {
    const decorator = Csrf();
    expect(SetMetadata).toHaveBeenCalledWith(CSRF_METADATA_VERIFY, true);
    expect(typeof decorator).toBe('function');
  });

  it('Csrf.NoVerify() should set CSRF_METADATA_NO_VERIFY = true', () => {
    const decorator = Csrf.NoVerify();
    expect(SetMetadata).toHaveBeenCalledWith(CSRF_METADATA_NO_VERIFY, true);
    expect(typeof decorator).toBe('function');
  });

  it('Csrf.Sign() should set CSRF_METADATA_SIGN = true', () => {
    const decorator = Csrf.Sign();
    expect(SetMetadata).toHaveBeenCalledWith(CSRF_METADATA_SIGN, true);
    expect(typeof decorator).toBe('function');
  });
});
