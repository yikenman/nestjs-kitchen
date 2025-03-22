import { Inject, Logger, StreamableFile } from '@nestjs/common';
import { isFunction, isNil } from '@nestjs/common/utils/shared.utils';
import type { Cache } from 'cache-manager';
import {
  CACHE_KEY_METADATA,
  CACHE_MANAGER,
  CACHE_MANAGER_SYMBOL,
  CACHE_RESULT_OPTIONS,
  CACHE_TTL_METADATA,
  CACHE_VERBOSE_LOG
} from '../cache.constants';
import type { CacheResultOptions } from '../interfaces';
import {
  copyMethodMetadata,
  getCacheResultMetdata,
  getMetadata,
  hashNoCoerce,
  isValidMethod,
  setCacheResultMetdata
} from '../utils';

export const CacheResult = () => {
  const injectCacheManager = Inject(CACHE_MANAGER);

  return (target: any, propertyKey: string, propertyDescriptor: PropertyDescriptor) => {
    injectCacheManager(target, CACHE_MANAGER_SYMBOL);

    const originalMethod = propertyDescriptor.value;

    if (getCacheResultMetdata(originalMethod)) {
      throw new Error('Cannot apply CacheResult decorator on the same method multiple times.');
    }
    setCacheResultMetdata(originalMethod);

    propertyDescriptor.value = async function (...args: any[]) {
      const that = this;

      const cacheManager: Cache = that[CACHE_MANAGER_SYMBOL];
      const verbose: boolean = cacheManager[CACHE_VERBOSE_LOG];
      const options: CacheResultOptions = cacheManager[CACHE_RESULT_OPTIONS];

      if (!isValidMethod(originalMethod)) {
        if (verbose) {
          Logger.warn(
            `"method: ${propertyKey}" is not a normal method. Falling back to the original method without caching.`,
            target.constructor.name
          );
        }
        return originalMethod.apply(that, args);
      }

      let key: string | undefined = undefined;
      let ttl: number | undefined = undefined;

      try {
        const keyOrFactroy = getMetadata<string | Function>(CACHE_KEY_METADATA, [originalMethod, target.constructor]);
        key =
          (isFunction(keyOrFactroy) ? await keyOrFactroy(args) : keyOrFactroy) ??
          `${target.constructor.name}.${propertyKey}:${hashNoCoerce.hash(args, {
            ...options
          })}`;

        if (isNil(key)) {
          if (verbose) {
            Logger.warn(
              `Invalid cache key. Falling back to the original method without caching.`,
              target.constructor.name
            );
          }
          return originalMethod.apply(that, args);
        }

        const value = await cacheManager.get(key);
        if (!isNil(value)) {
          return value;
        }

        const ttlOrFactroy = getMetadata<number | Function>(CACHE_TTL_METADATA, [originalMethod, target.constructor]);
        ttl = (isFunction(ttlOrFactroy) ? await ttlOrFactroy(args) : ttlOrFactroy) ?? undefined;
      } catch (error) {
        if (verbose) {
          Logger.warn(
            `An error has occurred when getting "key: ${key}". Falling back to the original method without caching`,
            error.stack,
            target.constructor.name
          );
        }
        return originalMethod.apply(that, args);
      }

      const result = await originalMethod.apply(that, args);
      if (result instanceof StreamableFile) {
        return result;
      }

      try {
        await cacheManager.set(...[key, result, ttl ?? undefined]);
      } catch (error) {
        Logger.error(
          `An error has occurred when inserting "key: ${key}", "value: ${result}"`,
          error.stack,
          target.constructor.name
        );
      }

      return result;
    };

    copyMethodMetadata(originalMethod, propertyDescriptor.value);

    return propertyDescriptor;
  };
};
