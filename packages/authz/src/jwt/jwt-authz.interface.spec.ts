import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import { normalizedArray, normalizedObject } from '../utils';
import { type JwtAuthzModuleOptions, type JwtOptions, normalizedJwtAuthzModuleOptions } from './jwt-authz.interface';

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');

  return {
    ...actual,
    normalizedArray: jest.fn(actual.normalizedArray),
    normalizedObject: jest.fn(actual.normalizedObject)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('JWT Authz Interface', () => {
  describe('normalizedJwtAuthzModuleOptions', () => {
    it('should normalize options with default values', () => {
      const options = {
        jwt: { algorithm: 'HS256', jwtFromRequest: () => 'token' },
        refresh: { algorithm: 'HS256', jwtFromRequest: () => 'token' }
      } as unknown as JwtAuthzModuleOptions;
      const result = normalizedJwtAuthzModuleOptions(options);

      expect(result.defaultOverride).toBe(false);
      expect(result.passportProperty).toBe(DEFAULT_PASSPORT_PROPERTY_VALUE);
      expect(result.skipFalsyMetadata).toBe(false);
      expect(result.defaultAllowAnonymous).toBe(false);

      expect(result.jwt).toBeDefined();
      expect(result.jwt.sign.algorithm).toBe('HS256');
      expect(result.refresh).toBeDefined();
      expect(result?.refresh?.sign.algorithm).toBe('HS256');
    });

    it('should override default values if provided in options', () => {
      const options = {
        defaultOverride: true,
        passportProperty: 'custom',
        skipFalsyMetadata: true,
        defaultAllowAnonymous: true,
        jwt: { algorithm: 'HS256' }
      } as unknown as JwtAuthzModuleOptions;
      const result = normalizedJwtAuthzModuleOptions(options);
      expect(result.defaultOverride).toBe(true);
      expect(result.passportProperty).toBe('custom');
      expect(result.skipFalsyMetadata).toBe(true);
      expect(result.defaultAllowAnonymous).toBe(true);
    });

    it('should handle undefined jwt options gracefully', () => {
      const options = {} as unknown as JwtAuthzModuleOptions;
      const result = normalizedJwtAuthzModuleOptions(options);
      expect(result.jwt).toBeUndefined();
    });

    it('should handle undefined refresh options gracefully', () => {
      const options = {
        jwt: { algorithm: 'HS256' }
      } as unknown as JwtAuthzModuleOptions;
      const result = normalizedJwtAuthzModuleOptions(options);
      expect(result.refresh).toBeUndefined();
    });

    describe('normalize JWT options', () => {
      beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(jest.fn);
      });

      it('should split options into JWT sign option and verify option', () => {
        const options = {
          jwtFromRequest: () => 'token',
          algorithm: ['algorithm'],
          audience: 'audience',
          clockTimestamp: 'clockTimestamp',
          clockTolerance: 'clockTolerance',
          complete: 'complete',
          ignoreExpiration: 'ignoreExpiration',
          ignoreNotBefore: 'ignoreNotBefore',
          issuer: 'issuer',
          jwtid: 'jwtid',
          maxAge: 'maxAge',
          nonce: 'nonce',
          privateKey: 'privateKey',
          publicKey: 'publicKey',
          secret: 'secret',
          subject: 'subject',
          allowInsecureKeySizes: 'allowInsecureKeySizes',
          encoding: 'encoding',
          expiresIn: 'expiresIn',
          header: 'header',
          keyid: 'keyid',
          mutatePayload: 'mutatePayload',
          noTimestamp: 'noTimestamp',
          notBefore: 'notBefore',
          allowInvalidAsymmetricKeyTypes: 'allowInvalidAsymmetricKeyTypes'
        } as unknown as JwtOptions;

        const { jwt } = normalizedJwtAuthzModuleOptions({ jwt: options });

        expect(normalizedArray).toHaveBeenCalledTimes(2);
        expect(normalizedArray).toHaveBeenNthCalledWith(1, options.jwtFromRequest);
        expect(normalizedArray).toHaveBeenNthCalledWith(2, options.algorithm);

        const signOptions = {
          algorithm: 'algorithm',
          audience: 'audience',
          issuer: 'issuer',
          jwtid: 'jwtid',
          subject: 'subject',
          allowInsecureKeySizes: 'allowInsecureKeySizes',
          encoding: 'encoding',
          expiresIn: 'expiresIn',
          header: 'header',
          keyid: 'keyid',
          mutatePayload: 'mutatePayload',
          notBefore: 'notBefore',
          noTimestamp: 'noTimestamp',
          allowInvalidAsymmetricKeyTypes: 'allowInvalidAsymmetricKeyTypes'
        };

        const verifyOptions = {
          algorithms: ['algorithm'],
          audience: 'audience',
          clockTimestamp: 'clockTimestamp',
          clockTolerance: 'clockTolerance',
          complete: 'complete',
          ignoreExpiration: 'ignoreExpiration',
          ignoreNotBefore: 'ignoreNotBefore',
          issuer: 'issuer',
          jwtid: 'jwtid',
          maxAge: 'maxAge',
          nonce: 'nonce',
          subject: 'subject',
          allowInvalidAsymmetricKeyTypes: 'allowInvalidAsymmetricKeyTypes'
        };

        expect(normalizedObject).toHaveBeenCalledTimes(2);
        expect(normalizedObject).toHaveBeenNthCalledWith(1, signOptions);
        expect(normalizedObject).toHaveBeenNthCalledWith(2, verifyOptions);

        expect(jwt?.sign).toEqual(signOptions);
        expect(jwt?.verify).toEqual(verifyOptions);
      });

      it('should return default value with empty object', () => {
        expect(normalizedJwtAuthzModuleOptions({ jwt: {} } as JwtAuthzModuleOptions)?.jwt).toEqual({
          secretOrPrivateKey: null,
          secretOrPublicKey: null,
          jwtFromRequest: [],
          sign: {},
          verify: {}
        });
      });

      it('should normalize jwtFromRequest as an array', () => {
        const options = {
          jwtFromRequest: () => 'token'
        };
        const { jwt } = normalizedJwtAuthzModuleOptions({
          jwt: options
        });
        expect(jwt?.jwtFromRequest).toEqual([options.jwtFromRequest]);
      });

      it('should return privateKey if secret and privateKey are defined', () => {
        const options = {
          secret: 'secret',
          privateKey: 'private-key'
        } as unknown as JwtOptions;
        const { jwt } = normalizedJwtAuthzModuleOptions({ jwt: options });
        expect(jwt?.secretOrPrivateKey).toEqual('private-key');
      });

      it('should return privateKey if secret and publicKey are defined', () => {
        const options = {
          secret: 'secret',
          publicKey: 'public-key'
        } as unknown as JwtOptions;
        const { jwt } = normalizedJwtAuthzModuleOptions({ jwt: options });
        expect(jwt?.secretOrPrivateKey).toBeNull();
        expect(jwt?.secretOrPublicKey).toEqual('public-key');
      });

      it('should log a warning if secret is provided along with privateKey or publicKey', () => {
        normalizedJwtAuthzModuleOptions({
          jwt: { secret: 'secret', privateKey: 'private-key' } as unknown as JwtOptions
        });
        normalizedJwtAuthzModuleOptions({
          jwt: { secret: 'secret', publicKey: 'public-key' } as unknown as JwtOptions
        });
        expect(console.warn).toHaveBeenCalledTimes(2);
      });
    });
  });
});
