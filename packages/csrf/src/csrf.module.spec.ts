import { Test } from '@nestjs/testing';
import Tokens from 'csrf';
import { CSRF_INSTANCE, CSRF_OPTIONS } from './constants';
import { CsrfModule } from './csrf.module';
import { CsrfModuleOptions } from './types';

describe('CsrfModule', () => {
  it('should provide merged CSRF_OPTIONS and CSRF_INSTANCE', async () => {
    const customOptions: CsrfModuleOptions = {
      type: 'double-csrf',
      cookieKey: 'x-custom-csrf',
      cookieOptions: {
        httpOnly: true,
        sameSite: 'strict'
      },
      // @ts-ignore
      sessionKey: '',
      oneTimeToken: false,
      oneTimeTokenTTL: 0,
      headerKey: 'x-custom-header',
      verifyMethods: ['POST'],
      nonceStore: {
        set: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      },
      saltLength: 10,
      secretLength: 30
    };

    const moduleRef = await Test.createTestingModule({
      imports: [CsrfModule.register(customOptions)]
    }).compile();

    const options = moduleRef.get(CSRF_OPTIONS);
    const tokens = moduleRef.get(CSRF_INSTANCE);

    expect(options).toBeDefined();
    expect(options.cookieKey).toBe('x-custom-csrf');
    expect(options.cookieOptions.httpOnly).toBe(true);
    expect(options.verifyMethodsSet).toBeInstanceOf(Set);
    expect(options.verifyMethodsSet.has('POST')).toBe(true);

    expect(tokens).toBeInstanceOf(Tokens);
    expect(tokens.saltLength).toBe(10);
    expect(tokens.secretLength).toBe(30);
  });
});
