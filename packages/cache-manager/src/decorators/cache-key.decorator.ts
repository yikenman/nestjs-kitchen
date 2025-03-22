import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { isNil } from '@nestjs/common/utils/shared.utils';
import { CACHE_KEY_METADATA } from '../cache.constants';

type CacheKeyExecutionContextFactory = (ctx: ExecutionContext) => Promise<string> | string;
type CacheKeyArgumentFactory = (args: any[]) => Promise<string> | string;

/**
 * Decorator that sets the caching key used to store/retrieve cached items for
 * Web sockets or Microservice based apps.
 *
 * For example:
 * `@CacheKey('events')`
 *
 * @param key string naming the field to be used as a cache key
 *
 * @see [Caching](https://docs.nestjs.com/techniques/caching)
 *
 * @publicApi
 */
export function CacheKey(key: string): MethodDecorator;
export function CacheKey(key: CacheKeyExecutionContextFactory): MethodDecorator & ClassDecorator;
export function CacheKey(key: CacheKeyArgumentFactory): MethodDecorator & ClassDecorator;
export function CacheKey(key: string | CacheKeyExecutionContextFactory | CacheKeyArgumentFactory) {
  if (isNil(key)) {
    throw new Error('CacheKey requires a valid key but received an empty or undefined value.');
  }
  return (target: any, propertyKey: any, propertyDescriptor: any) => {
    // class decorator cannot use string key
    if (propertyKey === undefined && propertyDescriptor === undefined && typeof key === 'string') {
      throw new Error('CacheKey cannot use a string key at the class level. Use a function instead.');
    }
    return SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, propertyDescriptor);
  };
}
