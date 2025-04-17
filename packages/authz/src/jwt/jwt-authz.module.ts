import { AsyncLocalStorage } from 'node:async_hooks';
import {
  ConfigurableModuleBuilder,
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  SetMetadata,
  type Type,
  UseGuards,
  applyDecorators
} from '@nestjs/common';
import { uid } from 'uid';
import { AuthzProviderClass } from '../authz.provider';
import { PREFIX, ROUTES_OPTIONS } from '../constants';
import { AuthzError } from '../errors';
import {
  type AbstractConstructor,
  type ApplyDecorators,
  type AuthzMetaParams,
  type AuthzModuleRoutesOptions,
  type RoutesOptions,
  createAuthzDecoratorFactory,
  mergeDynamicModuleConfigs,
  normalizedArray
} from '../utils';
import { type JwtAlsType, createJwtAuthzAlsMiddleware } from './jwt-authz-als.middleware';
import { createJwtAuthzGuard, createJwtRefreshAuthzGuard } from './jwt-authz.guard';
import {
  type JwtAuthzModuleOptions,
  type JwtAuthzOptions,
  normalizedJwtAuthzModuleOptions
} from './jwt-authz.interface';
import { createJwtAuthzService } from './jwt-authz.service';
import { createJwtStrategy, createRefreshStrategy } from './jwt-authz.strategy';

const store: {
  globalInited: number;
} = {
  globalInited: 0
};

const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<JwtAuthzModuleOptions>({
    moduleName: 'JwtAuthModule'
  })
    .setFactoryMethodName('createJwtAuthzModuleOptions')
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
 * Creates a JWT module along with its associated guard and service,
 * with types inferred from the provided implementation of `AuthzProviderClass`.
 *
 * @param authzProvider - The implementation class of `AuthzProviderClass`
 * @returns \{AuthzModule, AuthzGuard, AuthzService}
 */
export const createJwtAuthzModule = <P, U, T extends AuthzProviderClass<P, U>>(
  authzProvider: AbstractConstructor<T, P, U>
) => {
  // prevent token overriding
  const id = `${PREFIX}${uid()}`;

  // strategy tokens
  const JWT_STRATEGY = `${id}_JWT_STRATEGY`;
  const JWT_REFRESH_STRATEGY = `${id}_REFRESH_STRATEGY`;

  // provider tokens
  const AUTHZ_PROVIDER = `${id}_AUTHZ_PROVIDER`;
  const ALS_PROVIDER = `${id}_ALS_PROVIDER`;
  const JWT_AUTHZ_OPTIONS = `${id}_JWT_AUTHZ_OPTIONS`;

  // meta keys
  const JWT_META_KEY = `${id}_JWT_META_KEY`;
  const JWT_REFRESH_META_KEY = `${id}_REFRESH_META_KEY`;

  // providers
  const JwtAuthzService = createJwtAuthzService<P, U>([AUTHZ_PROVIDER, JWT_AUTHZ_OPTIONS, ALS_PROVIDER]);
  const JwtAuthzAlsMiddleware = createJwtAuthzAlsMiddleware([ALS_PROVIDER, JWT_AUTHZ_OPTIONS]);
  const als = new AsyncLocalStorage();

  // strategy
  const JwtStrategy = createJwtStrategy([JWT_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]);
  const RefreshStrategy = createRefreshStrategy([JWT_REFRESH_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]);
  // each strategy can be only registered once in passport.
  // no need to provide multiple times as
  //  1. they use the same ALS and authzProvider instance.
  //  2. guard use strategy through passport via strategy name.
  let isStrategyInited = false;

  // guards
  const RefreshAuthzGuard = createJwtRefreshAuthzGuard([JWT_REFRESH_STRATEGY, JWT_AUTHZ_OPTIONS]);
  const JwtAuthzGuard = createJwtAuthzGuard([
    JWT_STRATEGY,
    AUTHZ_PROVIDER,
    JWT_AUTHZ_OPTIONS,
    ALS_PROVIDER,
    JWT_META_KEY,
    JWT_REFRESH_META_KEY
  ]) as ReturnType<typeof createJwtAuthzGuard> & {
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
     * Ensures that only the refresh token is used for authentication on specific routes, for refreshing JWT tokens.
     *
     * ### Usage
     *
     * ```typescript
     * ⁣@UseGuards(AuthzGuard)
     * ⁣@Controller(/⁣/ ...)
     * export class BusinessController {
     *  ⁣@AuthzGuard.Refresh()
     *  ⁣@Get()
     *  async refreshToken() {
     *    // ...
     *  }
     * }
     * ```
     */
    Refresh: typeof Refresh;
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

  const Verify = createAuthzDecoratorFactory<T>(JWT_META_KEY);

  const NoVerify = (): MethodDecorator & ClassDecorator => {
    return SetMetadata(JWT_META_KEY, {
      options: { public: true, override: true }
    } as AuthzMetaParams);
  };

  const Refresh = (): MethodDecorator & ClassDecorator => {
    return applyDecorators(
      JwtAuthzGuard.NoVerify(),
      SetMetadata(JWT_REFRESH_META_KEY, true),
      UseGuards(RefreshAuthzGuard)
    );
  };

  const Apply = (...rest: Parameters<typeof Verify>) => {
    return applyDecorators(JwtAuthzGuard.Verify(...rest), UseGuards(JwtAuthzGuard));
  };

  JwtAuthzGuard.Verify = Verify;
  JwtAuthzGuard.NoVerify = NoVerify;
  JwtAuthzGuard.Refresh = Refresh;
  JwtAuthzGuard.Apply = Apply;

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
        ...(!isStrategyInited ? [JwtStrategy, RefreshStrategy] : []),
        JwtAuthzService
      ],
      exports: [AUTHZ_PROVIDER, ALS_PROVIDER, JWT_AUTHZ_OPTIONS, JwtAuthzService]
    };

    isStrategyInited = true;
    return configs;
  };

  @Module({})
  class JwtAuthzModule extends ConfigurableModuleClass implements NestModule {
    /**
     * Configures authz module.
     */
    static register(options: Omit<typeof OPTIONS_TYPE, 'authzProvider'>): DynamicModule {
      const jwtAuthzOptions = normalizedJwtAuthzModuleOptions(options);

      return mergeDynamicModuleConfigs(super.register({ ...options, authzProvider }), getCommonConfigs(), {
        providers: [
          {
            provide: JWT_AUTHZ_OPTIONS,
            useValue: jwtAuthzOptions
          }
        ]
      });
    }
    /**
     * Configures authz module asynchronously.
     */
    static registerAsync(options: Omit<typeof ASYNC_OPTIONS_TYPE, 'authzProvider'>): DynamicModule {
      return mergeDynamicModuleConfigs(super.registerAsync({ ...options, authzProvider }), getCommonConfigs(), {
        providers: [
          {
            provide: JWT_AUTHZ_OPTIONS,
            useFactory: (moduleOptions: JwtAuthzModuleOptions) => {
              const jwtAuthzOptions = normalizedJwtAuthzModuleOptions(moduleOptions);
              return jwtAuthzOptions;
            },
            inject: [MODULE_OPTIONS_TOKEN]
          }
        ]
      });
    }

    constructor(
      @Inject(ROUTES_OPTIONS)
      readonly routesOpt: RoutesOptions
    ) {
      super();
    }

    configure(consumer: MiddlewareConsumer) {
      consumer
        .apply(JwtAuthzAlsMiddleware)
        .exclude(...this.routesOpt.excludes)
        // nestjs v11 will be compatible with splat wildcard.
        .forRoutes(...(this.routesOpt.global ? ['*'] : this.routesOpt.routes));
    }
  }

  return {
    /**
     * A dynamic module used to configure JWT based authentication and authorization features for the application.
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
     *     // Import and configure JWT strategy
     *     AuthzModule.register({
     *       jwt: {
     *         jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
     *         secret: '1234567890',
     *         algorithm: 'HS256'
     *       },
     *       // Enable refresh token handling
     *       refresh: {
     *         jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
     *         secret: '0987654321',
     *         algorithm: 'HS256'
     *       },
     *       // Apply strategy to specific controllers.
     *       routes: [BusinessController]
     *     })
     *   ],
     *   controllers: [BusinessController]
     * })
     * export class BusinessModule {}
     * ```
     */
    AuthzModule: JwtAuthzModule,
    /**
     * A custom guard that applies authentication to controllers.
     *
     * This guard also provides 4 utility decorators to apply and modify authorization:
     *
     * - `@AuthzGuard.Verify`: Used to verify the user's authorization for specific meta data.
     * - `@AuthzGuard.NoVerify`: Used to `skip` authentication & authorization checks for specific routes.
     * - `@AuthzGuard.Apply`: A simplified version of `@UseGuards(AuthzGuard)` and `@AuthzGuard.Verify`, combining both for convenience.
     * - `@AuthzGuard.Refresh`: Used to ensure that only using refresh token for authentication on specific routes, for refreshing JWT tokens.
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
    AuthzGuard: JwtAuthzGuard,
    /**
     * A custom servcie to provide methods to handle authentication and authorization.
     */
    AuthzService: JwtAuthzService
  };
};
