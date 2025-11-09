import { Inject, Logger, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { createMiddleware } from './create-middleware';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './module-builder';
import type { HeadersModuleOptions } from './types';
import { noop } from './utils';

@Module({})
export class HeadersModule extends ConfigurableModuleClass implements NestModule {
  private logger = new Logger('HeadersModule');

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: HeadersModuleOptions
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer) {
    const debugLogger = this.options.debug
      ? (...rest: Parameters<typeof this.logger.debug>) => this.logger.debug(...rest)
      : noop;

    consumer
      .apply(
        createMiddleware({
          logger: debugLogger,
          ...this.options
        })
      )
      .forRoutes('*');
  }
}
