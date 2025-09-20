import { applyDecorators, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AsyncLocalStorage } from 'async_hooks';
import { uid } from 'uid';
import { AuthzProviderClass } from '../authz.provider';
import { PREFIX, ROUTES_OPTIONS } from '../constants';
import { AuthzError } from '../errors';
import {
  createAuthzDecoratorFactory,
  createOnceAdapterShimProvider,
  mergeDynamicModuleConfigs,
  normalizedArray
} from '../utils';
import { createSessionAuthzGuard } from './session-authz.guard';
import { normalizedSessionAuthzModuleOptions } from './session-authz.interface';
import { cereateSessionAuthzModule } from './session-authz.module';
import { createSessionAuthzService } from './session-authz.service';
import { createSessionAuthzAlsMiddleware } from './session-authz-als.middleware';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    SetMetadata: jest.fn(actual.SetMetadata),
    UseGuards: jest.fn(actual.UseGuards),
    applyDecorators: jest.fn(actual.applyDecorators)
  };
});

jest.mock('uid', () => {
  const actual = jest.requireActual('uid');

  return {
    ...actual,
    uid: jest.fn(actual.uid)
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');

  return {
    ...actual,
    createAuthzDecoratorFactory: jest.fn(actual.createAuthzDecoratorFactory),
    mergeDynamicModuleConfigs: jest.fn(actual.mergeDynamicModuleConfigs),
    normalizedArray: jest.fn(actual.normalizedArray),
    createOnceAdapterShimProvider: jest.fn(actual.createOnceAdapterShimProvider)
  };
});

jest.mock('./session-authz-als.middleware', () => {
  const actual = jest.requireActual('./session-authz-als.middleware');

  return {
    ...actual,
    createSessionAuthzAlsMiddleware: jest.fn(actual.createSessionAuthzAlsMiddleware)
  };
});

jest.mock('./session-authz.guard', () => {
  const actual = jest.requireActual('./session-authz.guard');

  return {
    ...actual,
    createSessionAuthzGuard: jest.fn(actual.createSessionAuthzGuard)
  };
});

jest.mock('./session-authz.interface', () => {
  const actual = jest.requireActual('./session-authz.interface');

  return {
    ...actual,
    normalizedSessionAuthzModuleOptions: jest.fn(actual.normalizedSessionAuthzModuleOptions)
  };
});

jest.mock('./session-authz.service', () => {
  const actual = jest.requireActual('./session-authz.service');

  return {
    ...actual,
    createSessionAuthzService: jest.fn(actual.createSessionAuthzService)
  };
});

interface Payload {
  payloadId1: string;
}

interface User {
  userId1: string;
}

@Injectable()
class TestAuthzProvider extends AuthzProviderClass<Payload, User> {
  authenticate(payload: Payload) {
    return {
      userId1: payload.payloadId1
    };
  }

  createPayload(user: User): Payload | Promise<Payload> {
    return {
      payloadId1: user.userId1
    };
  }
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Session Authz Module', () => {
  describe('cereateSessionAuthzModule', () => {
    it('should return module, service and guard', () => {
      const { AuthzGuard, AuthzModule, AuthzService } = cereateSessionAuthzModule(TestAuthzProvider);

      expect(uid).toHaveBeenCalled();

      const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;

      // provider tokens
      const AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
      const ALS_PROVIDER = `${id}_ALS_PROVIDER`;
      const SESSION_AUTHZ_OPTIONS = `${id}_SESSION_AUTHZ_OPTIONS`;

      // meta keys
      const SESSION_META_KEY = `${id}_SESSION_META_KEY`;

      expect(createSessionAuthzService).toHaveBeenCalledTimes(1);
      expect(createSessionAuthzService).toHaveBeenCalledWith([AUTHZ_PROVIDER, ALS_PROVIDER]);

      expect(createSessionAuthzAlsMiddleware).toHaveBeenCalledTimes(1);
      expect(createSessionAuthzAlsMiddleware).toHaveBeenCalledWith([ALS_PROVIDER, SESSION_AUTHZ_OPTIONS]);

      expect(createSessionAuthzGuard).toHaveBeenCalledTimes(1);
      expect(createSessionAuthzGuard).toHaveBeenCalledWith([
        AUTHZ_PROVIDER,
        SESSION_AUTHZ_OPTIONS,
        ALS_PROVIDER,
        SESSION_META_KEY
      ]);

      expect(createAuthzDecoratorFactory).toHaveBeenCalledTimes(1);
      expect(createAuthzDecoratorFactory).toHaveBeenCalledWith(SESSION_META_KEY);

      expect(AuthzModule).toBeDefined();
      expect(AuthzGuard).toBe(jest.mocked(createSessionAuthzGuard).mock.results[0].value);
      expect(AuthzService).toBe(jest.mocked(createSessionAuthzService).mock.results[0].value);
    });

    describe('SessionAuthzGuard with static methods', () => {
      let AuthzGuard: ReturnType<typeof cereateSessionAuthzModule>['AuthzGuard'];
      let SESSION_META_KEY: string;

      beforeEach(() => {
        const result = cereateSessionAuthzModule(TestAuthzProvider);

        const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;
        SESSION_META_KEY = `${id}_SESSION_META_KEY`;

        AuthzGuard = result.AuthzGuard;
      });

      it('should return SessionAuthzGuard with static methods', () => {
        expect(typeof AuthzGuard.Verify).toBe('function');
        expect(typeof AuthzGuard.NoVerify).toBe('function');
        expect(typeof AuthzGuard.Apply).toBe('function');
      });

      describe('Verify', () => {
        it('should be from createAuthzDecoratorFactory', () => {
          expect(AuthzGuard.Verify).toBe(jest.mocked(createAuthzDecoratorFactory).mock.results[0].value);
        });
      });

      describe('NoVerify', () => {
        it('should apply SESSION_META_KEY', () => {
          AuthzGuard.NoVerify();

          expect(SetMetadata).toHaveBeenCalledTimes(1);
          expect(SetMetadata).toHaveBeenCalledWith(SESSION_META_KEY, {
            options: { public: true, override: true }
          });
        });
      });

      describe('Apply', () => {
        it('should call Verify and apply SessionAuthzGuard', () => {
          const spyOnVerify = jest.spyOn(AuthzGuard, 'Verify');

          const params = 'META_DATA';
          //@ts-ignore
          AuthzGuard.Apply(params);

          expect(spyOnVerify).toHaveBeenCalledTimes(1);
          expect(spyOnVerify).toHaveBeenCalledWith(params);

          expect(UseGuards).toHaveBeenCalledTimes(1);
          expect(UseGuards).toHaveBeenCalledWith(jest.mocked(createSessionAuthzGuard).mock.results[0].value);

          expect(applyDecorators).toHaveBeenCalledTimes(1);
          expect(applyDecorators).toHaveBeenCalledWith(
            spyOnVerify.mock.results[0].value,
            jest.mocked(UseGuards).mock.results[0].value
          );
        });
      });
    });
  });

  describe('SessionAuthzModule', () => {
    type ModuleRegisterOptions = Parameters<ReturnType<typeof cereateSessionAuthzModule>['AuthzModule']['register']>[0];

    let module: TestingModule;

    describe('ConfigurableModuleBuilder.register', () => {
      let mockSessionAuthzOptions: ModuleRegisterOptions;

      beforeEach(async () => {
        mockSessionAuthzOptions = {
          session: {
            keepSessionInfo: true
          },
          passportProperty: 'user',
          routes: '/path-a'
        };

        const { AuthzModule } = cereateSessionAuthzModule(TestAuthzProvider);

        module = await Test.createTestingModule({
          imports: [AuthzModule.register(mockSessionAuthzOptions)]
        }).compile();
      });

      it('should provide ROUTES_OPTIONS', () => {
        const opts = module.get(ROUTES_OPTIONS);

        expect(normalizedArray).toHaveBeenCalledTimes(2);
        expect(normalizedArray).toHaveBeenNthCalledWith(1, mockSessionAuthzOptions.routes);
        expect(normalizedArray).toHaveBeenNthCalledWith(2, mockSessionAuthzOptions.excludes);

        expect(opts).toEqual({
          global: Boolean(mockSessionAuthzOptions.global),
          routes: jest.mocked(normalizedArray).mock.results[0].value ?? [],
          excludes: jest.mocked(normalizedArray).mock.results[1].value ?? []
        });
      });

      it('should throw an AuthzError if AuthzProvider is not provided', () => {
        expect(() => {
          //@ts-ignore
          cereateSessionAuthzModule().AuthzModule.register(mockSessionAuthzOptions);
        }).toThrow(new AuthzError(`InternalError: Missing parameter 'authzProvider' in configuration.`));
      });

      it('should throw an AuthzError if global and routes are not provided', () => {
        mockSessionAuthzOptions.routes = undefined;
        mockSessionAuthzOptions.global = undefined;

        expect(() => {
          cereateSessionAuthzModule(TestAuthzProvider).AuthzModule.register(mockSessionAuthzOptions);
        }).toThrow(new AuthzError(`InternalError: Missing parameter 'global' or 'routes' in configuration.`));
      });

      it('should throw an AuthzError if multiple global modules had been initialized', () => {
        mockSessionAuthzOptions.global = true;

        jest.isolateModules(() => {
          const { cereateSessionAuthzModule } = require('./session-authz.module');

          cereateSessionAuthzModule(TestAuthzProvider).AuthzModule.register(mockSessionAuthzOptions);

          expect(() => {
            cereateSessionAuthzModule(TestAuthzProvider).AuthzModule.register(mockSessionAuthzOptions);
          }).toThrow(`InternalError: Cannot initialize mutiple global modules. Only one global module is allowed.`);
        });
      });
    });

    describe('register', () => {
      const mockSessionAuthzOptions: ModuleRegisterOptions = {
        session: {
          keepSessionInfo: true
        },
        passportProperty: 'user',
        routes: '/path-a'
      };

      let AuthzModule: ReturnType<typeof cereateSessionAuthzModule>['AuthzModule'];
      let AUTHZ_PROVIDER: string;
      let ALS_PROVIDER: string;
      let SESSION_AUTHZ_OPTIONS: string;

      beforeEach(async () => {
        const result = cereateSessionAuthzModule(TestAuthzProvider);

        const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;
        AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
        ALS_PROVIDER = `${id}_ALS_PROVIDER`;
        SESSION_AUTHZ_OPTIONS = `${id}_SESSION_AUTHZ_OPTIONS`;

        AuthzModule = result.AuthzModule;

        module = await Test.createTestingModule({
          imports: [AuthzModule.register(mockSessionAuthzOptions)]
        }).compile();
      });

      it('should provide AUTHZ_PROVIDER', () => {
        const authzProvider = module.get(AUTHZ_PROVIDER);

        expect(authzProvider).toBeInstanceOf(TestAuthzProvider);
      });

      it('should provide ALS_PROVIDER', () => {
        const als = module.get(ALS_PROVIDER);

        expect(als).toBeInstanceOf(AsyncLocalStorage);
      });

      it('should provide SessionAuthzService', () => {
        const sessionAuthzService = module.get(jest.mocked(createSessionAuthzService).mock.results[0].value);

        expect(sessionAuthzService).toBeDefined();
      });

      it('should provide SESSION_AUTHZ_OPTIONS', () => {
        expect(normalizedSessionAuthzModuleOptions).toHaveBeenCalledTimes(1);
        expect(normalizedSessionAuthzModuleOptions).toHaveBeenCalledWith(mockSessionAuthzOptions);

        const sessionAuthzOptions = module.get(SESSION_AUTHZ_OPTIONS);

        expect(sessionAuthzOptions).toEqual(jest.mocked(normalizedSessionAuthzModuleOptions).mock.results[0].value);
      });

      it('should call mergeDynamicModuleConfigs', () => {
        expect(mergeDynamicModuleConfigs).toHaveBeenCalledTimes(2);
      });

      it('should call createOnceAdapterShimProvider', () => {
        expect(createOnceAdapterShimProvider).toHaveBeenCalled();
      });
    });

    describe('registerAsync', () => {
      const mockSessionAuthzOptions: ModuleRegisterOptions = {
        session: {
          keepSessionInfo: true
        },
        passportProperty: 'user',
        routes: '/path-a'
      };

      let AuthzModule: ReturnType<typeof cereateSessionAuthzModule>['AuthzModule'];
      let AUTHZ_PROVIDER: string;
      let ALS_PROVIDER: string;
      let SESSION_AUTHZ_OPTIONS: string;

      beforeEach(async () => {
        const result = cereateSessionAuthzModule(TestAuthzProvider);

        const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;
        AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
        ALS_PROVIDER = `${id}_ALS_PROVIDER`;
        SESSION_AUTHZ_OPTIONS = `${id}_SESSION_AUTHZ_OPTIONS`;

        AuthzModule = result.AuthzModule;

        module = await Test.createTestingModule({
          imports: [
            AuthzModule.registerAsync({
              routes: '/path-a',
              useFactory: () => {
                return mockSessionAuthzOptions;
              }
            })
          ]
        }).compile();
      });

      it('should provide AUTHZ_PROVIDER', () => {
        const authzProvider = module.get(AUTHZ_PROVIDER);

        expect(authzProvider).toBeInstanceOf(TestAuthzProvider);
      });

      it('should provide ALS_PROVIDER', () => {
        const als = module.get(ALS_PROVIDER);

        expect(als).toBeInstanceOf(AsyncLocalStorage);
      });

      it('should provide SESSION_AUTHZ_OPTIONS', () => {
        expect(normalizedSessionAuthzModuleOptions).toHaveBeenCalledTimes(1);
        expect(normalizedSessionAuthzModuleOptions).toHaveBeenCalledWith(mockSessionAuthzOptions);

        const sessionAuthzOptions = module.get(SESSION_AUTHZ_OPTIONS);

        expect(sessionAuthzOptions).toEqual(jest.mocked(normalizedSessionAuthzModuleOptions).mock.results[0].value);
      });

      it('should call mergeDynamicModuleConfigs', () => {
        expect(mergeDynamicModuleConfigs).toHaveBeenCalledTimes(2);
      });

      it('should call createOnceAdapterShimProvider', () => {
        expect(createOnceAdapterShimProvider).toHaveBeenCalled();
      });
    });

    describe('configure', () => {
      const baseModuleOptions: ModuleRegisterOptions = {
        session: {
          keepSessionInfo: true
        },
        passportProperty: 'user',
        routes: '/path-a'
      };

      const mockedRoutes: ModuleRegisterOptions['routes'] = ['/path-a'];
      const mockedExcludes: ModuleRegisterOptions['excludes'] = ['/path-b'];

      it('should register middleware with routes', async () => {
        const { AuthzModule } = cereateSessionAuthzModule(TestAuthzProvider);

        module = await Test.createTestingModule({
          imports: [
            AuthzModule.register({
              ...baseModuleOptions,
              routes: mockedRoutes,
              excludes: mockedExcludes
            })
          ]
        }).compile();
        // @ts-ignore
        const moduleInstance = module.get(AuthzModule);
        const middlewareConsumer = {
          apply: jest.fn().mockReturnThis(),
          exclude: jest.fn().mockReturnThis(),
          forRoutes: jest.fn()
        };

        moduleInstance.configure(middlewareConsumer as any);

        expect(middlewareConsumer.apply).toHaveBeenCalledWith(
          jest.mocked(createSessionAuthzAlsMiddleware).mock.results[0].value
        );
        expect(middlewareConsumer.exclude).toHaveBeenCalledWith(...mockedExcludes);
        expect(middlewareConsumer.forRoutes).toHaveBeenCalledWith(...mockedRoutes);
      });

      it("should apply '*splat' to consumer.forRoutes if options.global is true", async () => {
        const { AuthzModule } = cereateSessionAuthzModule(TestAuthzProvider);

        module = await Test.createTestingModule({
          imports: [
            AuthzModule.register({
              ...baseModuleOptions,
              routes: mockedRoutes,
              excludes: mockedExcludes,
              global: true
            })
          ]
        }).compile();
        // @ts-ignore
        const moduleInstance = module.get(AuthzModule);
        const middlewareConsumer = {
          apply: jest.fn().mockReturnThis(),
          exclude: jest.fn().mockReturnThis(),
          forRoutes: jest.fn()
        };

        moduleInstance.configure(middlewareConsumer as any);

        expect(middlewareConsumer.apply).toHaveBeenCalledWith(
          jest.mocked(createSessionAuthzAlsMiddleware).mock.results[0].value
        );
        expect(middlewareConsumer.exclude).toHaveBeenCalledWith(...mockedExcludes);
        expect(middlewareConsumer.forRoutes).toHaveBeenCalledWith('*');
      });
    });
  });
});
