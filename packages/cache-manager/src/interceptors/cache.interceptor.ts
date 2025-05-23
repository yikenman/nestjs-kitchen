import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
  StreamableFile
} from '@nestjs/common';
import { isFunction, isNil } from '@nestjs/common/utils/shared.utils';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_KEY_METADATA, CACHE_MANAGER, CACHE_TTL_METADATA, CACHE_VERBOSE_LOG } from '../cache.constants';

/**
 * @see [Caching](https://docs.nestjs.com/techniques/caching)
 *
 * @publicApi
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  @Optional()
  @Inject()
  protected readonly httpAdapterHost: HttpAdapterHost;

  protected allowedMethods = ['GET'];

  constructor(
    @Inject(CACHE_MANAGER) protected readonly cacheManager: any,
    protected readonly reflector: Reflector
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    let key: string | undefined = undefined;

    try {
      key = await this.trackBy(context);

      if (!key) {
        if (this.cacheManager[CACHE_VERBOSE_LOG]) {
          Logger.warn(`Invalid cache key. Falling back to the original method without caching.`, 'CacheInterceptor');
        }
        return next.handle();
      }

      const value = await this.cacheManager.get(key);

      if (!isNil(value)) {
        this.setHeadersWhenHttp(context, value);
        return of(value);
      }

      const ttlValueOrFactory =
        this.reflector.get(CACHE_TTL_METADATA, context.getHandler()) ??
        this.reflector.get(CACHE_TTL_METADATA, context.getClass()) ??
        null;
      const ttl = isFunction(ttlValueOrFactory) ? await ttlValueOrFactory(context) : ttlValueOrFactory;

      this.setHeadersWhenHttp(context, value);

      return next.handle().pipe(
        tap(async (response) => {
          if (response instanceof StreamableFile) {
            return;
          }

          const args = [key, response];
          if (!isNil(ttl)) {
            args.push(ttl);
          }

          try {
            await this.cacheManager.set(...args);
          } catch (err) {
            Logger.error(
              `An error has occurred when inserting "key: ${key}", "value: ${response}"`,
              err.stack,
              'CacheInterceptor'
            );
          }
        })
      );
    } catch (err) {
      if (this.cacheManager[CACHE_VERBOSE_LOG]) {
        Logger.warn(
          `An error has occurred when getting "key: ${key}". Falling back to the original method without caching`,
          err.stack,
          'CacheInterceptor'
        );
      }
      return next.handle();
    }
  }

  protected trackBy(context: ExecutionContext): Promise<string | undefined> | string | undefined {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const isHttpApp = httpAdapter && !!httpAdapter.getRequestMethod;
    const keyValueOrFactory =
      this.reflector.get(CACHE_KEY_METADATA, context.getHandler()) ??
      this.reflector.get(CACHE_KEY_METADATA, context.getClass()) ??
      null;

    if (!isHttpApp || keyValueOrFactory) {
      return isFunction(keyValueOrFactory) ? keyValueOrFactory(context) : keyValueOrFactory;
    }
    const request = context.getArgByIndex(0);
    if (!this.isRequestCacheable(context)) {
      return undefined;
    }
    return httpAdapter.getRequestUrl(request);
  }

  protected isRequestCacheable(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    return this.allowedMethods.includes(req.method);
  }

  protected setHeadersWhenHttp(context: ExecutionContext, value: any): void {
    if (!this.httpAdapterHost) {
      return;
    }
    const { httpAdapter } = this.httpAdapterHost;
    if (!httpAdapter) {
      return;
    }
    const response = context.switchToHttp().getResponse();
    httpAdapter.setHeader(response, 'X-Cache', isNil(value) ? 'MISS' : 'HIT');
  }
}
