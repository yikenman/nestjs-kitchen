import { AsyncLocalStorage } from 'node:async_hooks';
import {
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  DynamicModule,
  type ExecutionContext,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  SetMetadata,
  type Type,
  UseGuards,
  applyDecorators
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { uid } from 'uid';
import { AuthzProviderClass } from '../authz.provider';
import { PREFIX, ROUTES_OPTIONS } from '../constants';
import { AuthzError } from '../errors';
import {
  type AbstractConstructor,
  type ApplyDecorators,
  type AuthzDecoParams,
  type AuthzMetaParams,
  type AuthzModuleBaseOptions,
  type AuthzModuleRoutesOptions,
  type CookieOptionsWithSecret,
  type DeepReadonly,
  type MethodParameters,
  type RoutesOptions,
  createAuthzDecoratorFactory,
  mergeDynamicModuleConfigs,
  normalizedArray
} from '../utils';
import { type SessionAlsType, createSessionAuthzAlsMiddleware } from './session-authz-als.middleware';
import { createSessionAuthzGuard } from './session-authz.guard';
import {
  type SessionAuthzModuleOptions,
  type SessionAuthzOptions,
  normalizedSessionAuthzModuleOptions
} from './session-authz.interface';
import { createSessionAuthzService } from './session-authz.service';
import { createSessionAuthzStrategy } from './session-authz.strategy';

const store: Record<any, number> = {
  globalInited: 0
};

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<SessionAuthzModuleOptions>({
    moduleName: 'SessionAuthModule'
  })
    .setFactoryMethodName('createSessionAuthzModuleOptions')
    .setExtras<
      {
        authzProvider?: Type<AuthzProviderClass<unknown, unknown>>;
      } & AuthzModuleRoutesOptions
    >(
      {
        authzProvider: undefined,
        global: false
      },
      (definition, extras) => {
        const { authzProvider, global } = extras;

        if (!authzProvider) {
          throw new AuthzError(`InternalError: Missing parameter 'authzProvider' in configuration.`);
        }

        const routes = normalizedArray(extras.routes) ?? [];
        const excludes = normalizedArray(extras.excludes) ?? [];

        if (!global && !routes.length) {
          throw new AuthzError(`InternalError: Missing parameter 'global' or 'routes' in configuration.`);
        }

        if (global) {
          if (store.globalInited) {
            throw new AuthzError(
              `InternalError: Cannot initialize mutiple global modules. Only one global module is allowed.`
            );
          }

          store.globalInited += 1;
        }

        return mergeDynamicModuleConfigs(definition, {
          global,
          providers: [
            {
              provide: ROUTES_OPTIONS,
              useValue: {
                global,
                excludes,
                routes
              }
            }
          ],
          exports: []
        });
      }
    )
    .build();

/**
 * Creates a session module along with its associated guard and service,
 * with types inferred from the provided implementation of `AuthzProviderClass`.
 *
 * @param authzProvider - The implementation class of `AuthzProviderClass`
 * @returns \{AuthzModule, AuthzGuard, AuthzService}
 */
export const cereateSessionAuthzModule = <P, U, T extends AuthzProviderClass<P, U>>(
  authzProvider: AbstractConstructor<T, P, U>
) => {
  const id = `${PREFIX}${uid()}`;

  // strategy tokens
  const SESSION_STRATEGY = `${id}_SESSION_STRATEGY`;

  // provider tokens
  const AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
  const ALS_PROVIDER = `${id}_ALS_PROVIDER`;
  const SESSION_AUTHZ_OPTIONS = `${id}_SESSION_AUTHZ_OPTIONS`;

  // meta keys
  const SESSION_META_KEY = `${id}_SESSION_META_KEY`;

  // strategies
  const SessionAuthzStrategy = createSessionAuthzStrategy([SESSION_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]);

  // providers
  const SessionAuthzService = createSessionAuthzService<P, U>([AUTHZ_PROVIDER, ALS_PROVIDER]);
  const SessionAuthzAlsMiddleware = createSessionAuthzAlsMiddleware([ALS_PROVIDER, SESSION_AUTHZ_OPTIONS]);
  const als = new AsyncLocalStorage();
  // each strategy can be only registered once in passport.
  // no need to provide multiple times as
  //  1. they use the same ALS and authzProvider instance.
  //  2. guard use strategy through passport via strategy name.
  let isStrategyInited = false;

  // guards
  const SessionAuthzGuard = createSessionAuthzGuard([
    SESSION_STRATEGY,
    AUTHZ_PROVIDER,
    SESSION_AUTHZ_OPTIONS,
    ALS_PROVIDER,
    SESSION_META_KEY
  ]) as ReturnType<typeof createSessionAuthzGuard> & {
    /**
     * Verifies the user's authorization for specific meta data.
     *
     * ### Usage
     *
     * ```typescript
     * ⁣@UseGuards(AuthzGuard)
     * ⁣@Controller(/⁣/ ...)
     * export class BusinessController {
     *  ⁣@AuthzGuard.Verify(/⁣/ mata datas used to authorize user)
     *  ⁣@Get()
     *  async method() {
     *    // ...
     *  }
     * }
     * ```
     */
    Verify: typeof Verify;
    /**
     * Skips authentication & authorization checks for specific routes.
     *
     * ### Usage
     *
     * ```typescript
     * ⁣@UseGuards(AuthzGuard)
     * ⁣@Controller(/⁣/ ...)
     * export class BusinessController {
     *  ⁣@AuthzGuard.NoVerify()
     *  ⁣@Get()
     *  async publicMethod() {
     *    // ...
     *  }
     * }
     * ```
     */
    NoVerify: typeof NoVerify;
    /**
     * A simplified version of `@UseGuards(AuthzGuard)` and `@AuthzGuard.Verify()`, combining both for convenience
     *
     * ### Usage
     *
     * ```typescript
     * ⁣@Controller(/⁣/ ...)
     * export class BusinessController {
     *   ⁣@AuthzGuard.Apply(/⁣/ mata datas used to authorize user)
     *   ⁣@Get()
     *   async refreshToken() {
     *     // ...
     *   }
     * }
     * ```
     */
    Apply: typeof Apply;
  };

  const Verify = createAuthzDecoratorFactory<T>(SESSION_META_KEY);

  const NoVerify = (): MethodDecorator & ClassDecorator => {
    return SetMetadata(SESSION_META_KEY, {
      options: { public: true, override: true }
    } as AuthzMetaParams);
  };

  const Apply = (...rest: Parameters<typeof Verify>) => {
    return applyDecorators(SessionAuthzGuard.Verify(...rest), UseGuards(SessionAuthzGuard));
  };

  SessionAuthzGuard.Verify = Verify;
  SessionAuthzGuard.NoVerify = NoVerify;
  SessionAuthzGuard.Apply = Apply;

  const getCommonConfigs = () => {
    const configs: Partial<DynamicModule> = {
      providers: [
        {
          provide: AUTHZ_PROVIDER,
          useClass: authzProvider
        },
        {
          provide: ALS_PROVIDER,
          useValue: als
        },
        ...(!isStrategyInited ? [SessionAuthzStrategy] : []),
        SessionAuthzService
      ],
      exports: [AUTHZ_PROVIDER, ALS_PROVIDER, SESSION_AUTHZ_OPTIONS, SessionAuthzService]
    };

    isStrategyInited = true;
    return configs;
  };

  @Module({})
  class SessionAuthzModule extends ConfigurableModuleClass implements NestModule {
    /**
     * Configures authz module.
     *
     */
    static register(options: Omit<typeof OPTIONS_TYPE, 'authzProvider'>): DynamicModule {
      const sessionAuthzOptions = normalizedSessionAuthzModuleOptions(options);

      return mergeDynamicModuleConfigs(super.register({ ...options, authzProvider }), getCommonConfigs(), {
        providers: [
          {
            provide: SESSION_AUTHZ_OPTIONS,
            useValue: sessionAuthzOptions
          }
        ]
      });
    }

    /**
     * Configures authz module asynchronously.
     *
     */
    static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
      return mergeDynamicModuleConfigs(super.registerAsync({ ...options, authzProvider }), getCommonConfigs(), {
        providers: [
          {
            provide: SESSION_AUTHZ_OPTIONS,
            useFactory: (moduleOptions: SessionAuthzModuleOptions) => {
              return normalizedSessionAuthzModuleOptions(moduleOptions);
            },
            inject: [MODULE_OPTIONS_TOKEN]
          }
        ]
      });
    }

    constructor(
      @Inject(ROUTES_OPTIONS)
      readonly routesOpt: RoutesOptions,
      @Inject(SESSION_AUTHZ_OPTIONS)
      readonly sessionAuthzOptions: SessionAuthzOptions
    ) {
      super();
    }

    configure(consumer: MiddlewareConsumer) {
      consumer
        .apply(SessionAuthzAlsMiddleware)
        .exclude(...this.routesOpt.excludes)
        // nestjs v11 will be compatible with splat wildcard.
        .forRoutes(...(this.routesOpt.global ? ['*'] : this.routesOpt.routes));
    }
  }

  return {
    /**
     * A dynamic module used to configure session based authentication and authorization features for the application.
     *
     * This module can be configured using 2 static methods:
     *
     * - `register`
     * - `registerAsync`
     *
     * ### Usage
     *
     * ```typescript
     * ⁣@Module({
     *   imports: [
     *     // Import and configure session strategy
     *     AuthzModule.register({
     *       session: {
     *         name: 'custom-session-id-name',
     *         secret: '1234567890'
     *       },
     *       // Define routes that use AuthzGuard
     *       routes: [BusinessController]
     *     })
     *   ],
     *   controllers: [BusinessController]
     * })
     * export class BusinessModule {}
     * ```
     */
    AuthzModule: SessionAuthzModule,
    /**
     * A custom guard that applies authentication to controllers.
     *
     * This guard also provides 3 utility decorators to apply and modify authorization:
     *
     * - `@AuthzGuard.Verify`: Used to verify the user's authorization for specific meta data.
     * - `@AuthzGuard.NoVerify`: Used to `skip` authentication & authorization checks for specific routes.
     * - `@AuthzGuard.Apply`: A simplified version of `@UseGuards(AuthzGuard)` and `@AuthzGuard.Verify`, combining both for convenience.
     *
     * ### Usage:
     *
     * ```typescript
     * ⁣@UseGuards(AuthzGuard)
     * ⁣@Controller(/⁣/ ...)
     * export class BusinessController {
     *   // ...
     * }
     * ```
     */
    AuthzGuard: SessionAuthzGuard,
    /**
     * A custom servcie to provide methods to handle authentication and authorization.
     */
    AuthzService: SessionAuthzService
  };
};
