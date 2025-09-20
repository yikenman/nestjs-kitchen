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
import { createJwtAuthzGuard, createJwtRefreshAuthzGuard } from './jwt-authz.guard';
import { normalizedJwtAuthzModuleOptions } from './jwt-authz.interface';
import { createJwtAuthzModule } from './jwt-authz.module';
import { createJwtAuthzService } from './jwt-authz.service';
import { createJwtAuthzAlsMiddleware } from './jwt-authz-als.middleware';

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

jest.mock('./jwt-authz-als.middleware', () => {
  const actual = jest.requireActual('./jwt-authz-als.middleware');

  return {
    ...actual,
    createJwtAuthzAlsMiddleware: jest.fn(actual.createJwtAuthzAlsMiddleware)
  };
});

jest.mock('./jwt-authz.guard', () => {
  const actual = jest.requireActual('./jwt-authz.guard');

  return {
    ...actual,
    createJwtAuthzGuard: jest.fn(actual.createJwtAuthzGuard),
    createJwtRefreshAuthzGuard: jest.fn(actual.createJwtRefreshAuthzGuard)
  };
});

jest.mock('./jwt-authz.interface', () => {
  const actual = jest.requireActual('./jwt-authz.interface');

  return {
    ...actual,
    normalizedJwtAuthzModuleOptions: jest.fn(actual.normalizedJwtAuthzModuleOptions)
  };
});

jest.mock('./jwt-authz.service', () => {
  const actual = jest.requireActual('./jwt-authz.service');

  return {
    ...actual,
    createJwtAuthzService: jest.fn(actual.createJwtAuthzService)
  };
});

interface Payload {
  payloadId1: string;
}

interface User {
  userId1: string;
}

@Injectable()
class TestJwtAuthzProvider extends AuthzProviderClass<Payload, User> {
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

describe('JWT Authz Module', () => {
  describe('createJwtAuthzModule', () => {
    it('should return module, service and guard', () => {
      const { AuthzGuard, AuthzModule, AuthzService } = createJwtAuthzModule(TestJwtAuthzProvider);

      expect(uid).toHaveBeenCalled();

      const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;

      // provider tokens
      const AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
      const ALS_PROVIDER = `${id}_ALS_PROVIDER`;
      const JWT_AUTHZ_OPTIONS = `${id}_JWT_AUTHZ_OPTIONS`;

      // meta keys
      const JWT_META_KEY = `${id}_JWT_META_KEY`;
      const JWT_REFRESH_META_KEY = `${id}_REFRESH_META_KEY`;

      expect(createJwtAuthzService).toHaveBeenCalledTimes(1);
      expect(createJwtAuthzService).toHaveBeenCalledWith([AUTHZ_PROVIDER, JWT_AUTHZ_OPTIONS, ALS_PROVIDER]);

      expect(createJwtAuthzAlsMiddleware).toHaveBeenCalledTimes(1);
      expect(createJwtAuthzAlsMiddleware).toHaveBeenCalledWith([ALS_PROVIDER]);

      expect(createJwtRefreshAuthzGuard).toHaveBeenCalledTimes(1);
      expect(createJwtRefreshAuthzGuard).toHaveBeenCalledWith([JWT_AUTHZ_OPTIONS, AUTHZ_PROVIDER, ALS_PROVIDER]);

      expect(createJwtAuthzGuard).toHaveBeenCalledTimes(1);
      expect(createJwtAuthzGuard).toHaveBeenCalledWith([
        AUTHZ_PROVIDER,
        JWT_AUTHZ_OPTIONS,
        ALS_PROVIDER,
        JWT_META_KEY,
        JWT_REFRESH_META_KEY
      ]);

      expect(createAuthzDecoratorFactory).toHaveBeenCalledTimes(1);
      expect(createAuthzDecoratorFactory).toHaveBeenCalledWith(JWT_META_KEY);

      expect(AuthzModule).toBeDefined();
      expect(AuthzGuard).toBe(jest.mocked(createJwtAuthzGuard).mock.results[0].value);
      expect(AuthzService).toBe(jest.mocked(createJwtAuthzService).mock.results[0].value);
    });

    describe('JwtAuthzGuard with static methods', () => {
      let AuthzGuard: ReturnType<typeof createJwtAuthzModule>['AuthzGuard'];
      let JWT_META_KEY: string;
      let JWT_REFRESH_META_KEY: string;

      beforeEach(() => {
        const result = createJwtAuthzModule(TestJwtAuthzProvider);

        const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;
        JWT_META_KEY = `${id}_JWT_META_KEY`;
        JWT_REFRESH_META_KEY = `${id}_REFRESH_META_KEY`;

        AuthzGuard = result.AuthzGuard;
      });

      it('should return JwtAuthzGuard with static methods', () => {
        expect(typeof AuthzGuard.Verify).toBe('function');
        expect(typeof AuthzGuard.NoVerify).toBe('function');
        expect(typeof AuthzGuard.Refresh).toBe('function');
        expect(typeof AuthzGuard.Apply).toBe('function');
      });

      describe('Verify', () => {
        it('should be from createAuthzDecoratorFactory', () => {
          expect(AuthzGuard.Verify).toBe(jest.mocked(createAuthzDecoratorFactory).mock.results[0].value);
        });
      });

      describe('NoVerify', () => {
        it('should apply JWT_META_KEY', () => {
          AuthzGuard.NoVerify();

          expect(SetMetadata).toHaveBeenCalledTimes(1);
          expect(SetMetadata).toHaveBeenCalledWith(JWT_META_KEY, {
            options: { public: true, override: true }
          });
        });
      });

      describe('Refresh', () => {
        it('should call NoVerify and apply JWT_REFRESH_META_KEY with RefreshAuthzGuard', () => {
          const spyOnNoVerify = jest.spyOn(AuthzGuard, 'NoVerify');

          AuthzGuard.Refresh();

          expect(spyOnNoVerify).toHaveBeenCalledTimes(1);

          expect(SetMetadata).toHaveBeenCalledTimes(2);
          expect(SetMetadata).toHaveBeenNthCalledWith(2, JWT_REFRESH_META_KEY, true);

          expect(UseGuards).toHaveBeenCalledTimes(1);
          expect(UseGuards).toHaveBeenCalledWith(jest.mocked(createJwtRefreshAuthzGuard).mock.results[0].value);

          expect(applyDecorators).toHaveBeenCalledTimes(1);
          expect(applyDecorators).toHaveBeenCalledWith(
            spyOnNoVerify.mock.results[0].value,
            jest.mocked(SetMetadata).mock.results[1].value,
            jest.mocked(UseGuards).mock.results[0].value
          );
        });
      });

      describe('Apply', () => {
        it('should call Verify and apply JwtAuthzGuard', () => {
          const spyOnVerify = jest.spyOn(AuthzGuard, 'Verify');

          const params = 'META_DATA';
          //@ts-ignore
          AuthzGuard.Apply(params);

          expect(spyOnVerify).toHaveBeenCalledTimes(1);
          expect(spyOnVerify).toHaveBeenCalledWith(params);

          expect(UseGuards).toHaveBeenCalledTimes(1);
          expect(UseGuards).toHaveBeenCalledWith(jest.mocked(createJwtAuthzGuard).mock.results[0].value);

          expect(applyDecorators).toHaveBeenCalledTimes(1);
          expect(applyDecorators).toHaveBeenCalledWith(
            spyOnVerify.mock.results[0].value,
            jest.mocked(UseGuards).mock.results[0].value
          );
        });
      });
    });
  });

  describe('JwtAuthzModule', () => {
    type ModuleRegisterOptions = Parameters<ReturnType<typeof createJwtAuthzModule>['AuthzModule']['register']>[0];

    let module: TestingModule;

    describe('ConfigurableModuleBuilder.register', () => {
      let mockJwtAuthzOptions: ModuleRegisterOptions;

      beforeEach(async () => {
        mockJwtAuthzOptions = {
          jwt: { secret: 'secret-key', jwtFromRequest: [] },
          passportProperty: 'user',
          routes: '/path-a'
        } as unknown as ModuleRegisterOptions;

        const { AuthzModule } = createJwtAuthzModule(TestJwtAuthzProvider);

        module = await Test.createTestingModule({
          imports: [AuthzModule.register(mockJwtAuthzOptions)]
        }).compile();
      });

      it('should provide ROUTES_OPTIONS', () => {
        const opts = module.get(ROUTES_OPTIONS);

        expect(normalizedArray).toHaveBeenCalledTimes(4);
        expect(normalizedArray).toHaveBeenNthCalledWith(3, mockJwtAuthzOptions.routes);
        expect(normalizedArray).toHaveBeenNthCalledWith(4, mockJwtAuthzOptions.excludes);

        expect(opts).toEqual({
          global: Boolean(mockJwtAuthzOptions.global),
          routes: jest.mocked(normalizedArray).mock.results[2].value ?? [],
          excludes: jest.mocked(normalizedArray).mock.results[3].value ?? []
        });
      });

      it('should throw an AuthzError if AuthzProvider is not provided', () => {
        expect(() => {
          //@ts-ignore
          createJwtAuthzModule().AuthzModule.register(mockJwtAuthzOptions);
        }).toThrow(new AuthzError(`InternalError: Missing parameter 'authzProvider' in configuration.`));
      });

      it('should throw an AuthzError if global and routes are not provided', () => {
        mockJwtAuthzOptions.routes = undefined;
        mockJwtAuthzOptions.global = undefined;

        expect(() => {
          createJwtAuthzModule(TestJwtAuthzProvider).AuthzModule.register(mockJwtAuthzOptions);
        }).toThrow(new AuthzError(`InternalError: Missing parameter 'global' or 'routes' in configuration.`));
      });

      it('should throw an AuthzError if multiple global modules had been initialized', () => {
        mockJwtAuthzOptions.global = true;

        jest.isolateModules(() => {
          const { createJwtAuthzModule } = require('./jwt-authz.module');

          createJwtAuthzModule(TestJwtAuthzProvider).AuthzModule.register(mockJwtAuthzOptions);

          expect(() => {
            createJwtAuthzModule(TestJwtAuthzProvider).AuthzModule.register(mockJwtAuthzOptions);
          }).toThrow(`InternalError: Cannot initialize mutiple global modules. Only one global module is allowed.`);
        });
      });
    });

    describe('register', () => {
      const mockJwtAuthzOptions: ModuleRegisterOptions = {
        jwt: { secret: 'secret-key', jwtFromRequest: [] },
        passportProperty: 'user',
        routes: '/path-a'
      };

      let AuthzModule: ReturnType<typeof createJwtAuthzModule>['AuthzModule'];
      let AUTHZ_PROVIDER: string;
      let ALS_PROVIDER: string;
      let JWT_AUTHZ_OPTIONS: string;

      beforeEach(async () => {
        const result = createJwtAuthzModule(TestJwtAuthzProvider);

        const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;
        AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
        ALS_PROVIDER = `${id}_ALS_PROVIDER`;
        JWT_AUTHZ_OPTIONS = `${id}_JWT_AUTHZ_OPTIONS`;

        AuthzModule = result.AuthzModule;

        module = await Test.createTestingModule({
          imports: [AuthzModule.register(mockJwtAuthzOptions)]
        }).compile();
      });

      it('should provide AUTHZ_PROVIDER', () => {
        const authzProvider = module.get(AUTHZ_PROVIDER);

        expect(authzProvider).toBeInstanceOf(TestJwtAuthzProvider);
      });

      it('should provide ALS_PROVIDER', () => {
        const als = module.get(ALS_PROVIDER);

        expect(als).toBeInstanceOf(AsyncLocalStorage);
      });

      it('should provide JwtAuthzService', () => {
        const jwtAuthzService = module.get(jest.mocked(createJwtAuthzService).mock.results[0].value);

        expect(jwtAuthzService).toBeDefined();
      });

      it('should provide JWT_AUTHZ_OPTIONS', () => {
        expect(normalizedJwtAuthzModuleOptions).toHaveBeenCalledTimes(1);
        expect(normalizedJwtAuthzModuleOptions).toHaveBeenCalledWith(mockJwtAuthzOptions);

        const jwtAuthzOptions = module.get(JWT_AUTHZ_OPTIONS);

        expect(jwtAuthzOptions).toEqual(jest.mocked(normalizedJwtAuthzModuleOptions).mock.results[0].value);
      });

      it('should call mergeDynamicModuleConfigs', () => {
        expect(mergeDynamicModuleConfigs).toHaveBeenCalledTimes(2);
      });

      it('should call createOnceAdapterShimProvider', () => {
        expect(createOnceAdapterShimProvider).toHaveBeenCalled();
      });
    });

    describe('registerAsync', () => {
      const mockJwtAuthzOptions: ModuleRegisterOptions = {
        jwt: { secret: 'secret-key', jwtFromRequest: [] },
        passportProperty: 'user'
      };

      let AuthzModule: ReturnType<typeof createJwtAuthzModule>['AuthzModule'];
      let AUTHZ_PROVIDER: string;
      let ALS_PROVIDER: string;
      let JWT_AUTHZ_OPTIONS: string;

      beforeEach(async () => {
        const result = createJwtAuthzModule(TestJwtAuthzProvider);

        AuthzModule = result.AuthzModule;
        const id = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;
        AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
        ALS_PROVIDER = `${id}_ALS_PROVIDER`;
        JWT_AUTHZ_OPTIONS = `${id}_JWT_AUTHZ_OPTIONS`;

        module = await Test.createTestingModule({
          imports: [
            AuthzModule.registerAsync({
              routes: '/path-a',
              useFactory: () => {
                return mockJwtAuthzOptions;
              }
            })
          ]
        }).compile();
      });

      it('should provide AUTHZ_PROVIDER', () => {
        const authzProvider = module.get(AUTHZ_PROVIDER);

        expect(authzProvider).toBeInstanceOf(TestJwtAuthzProvider);
      });

      it('should provide ALS_PROVIDER', () => {
        const als = module.get(ALS_PROVIDER);

        expect(als).toBeInstanceOf(AsyncLocalStorage);
      });

      it('should provide JWT_AUTHZ_OPTIONS', () => {
        expect(normalizedJwtAuthzModuleOptions).toHaveBeenCalledTimes(1);
        expect(normalizedJwtAuthzModuleOptions).toHaveBeenCalledWith(mockJwtAuthzOptions);

        const jwtAuthzOptions = module.get(JWT_AUTHZ_OPTIONS);

        expect(jwtAuthzOptions).toEqual(jest.mocked(normalizedJwtAuthzModuleOptions).mock.results[0].value);
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
        jwt: { secret: 'secret-key', jwtFromRequest: [] }
      };

      const mockedRoutes: ModuleRegisterOptions['routes'] = ['/path-a'];
      const mockedExcludes: ModuleRegisterOptions['excludes'] = ['/path-b'];

      it('should register middleware with routes', async () => {
        const { AuthzModule } = createJwtAuthzModule(TestJwtAuthzProvider);

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
          jest.mocked(createJwtAuthzAlsMiddleware).mock.results[0].value
        );
        expect(middlewareConsumer.exclude).toHaveBeenCalledWith(...mockedExcludes);
        expect(middlewareConsumer.forRoutes).toHaveBeenCalledWith(...mockedRoutes);
      });

      it("should apply '*splat' to consumer.forRoutes if options.global is true", async () => {
        const { AuthzModule } = createJwtAuthzModule(TestJwtAuthzProvider);

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
          jest.mocked(createJwtAuthzAlsMiddleware).mock.results[0].value
        );
        expect(middlewareConsumer.exclude).toHaveBeenCalledWith(...mockedExcludes);
        expect(middlewareConsumer.forRoutes).toHaveBeenCalledWith('*');
      });
    });
  });
});
