import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { isNil } from '@nestjs/common/utils/shared.utils';
import { CACHE_TTL_METADATA } from '../cache.constants';

type CacheTTLExecutionContextFactory = (ctx: ExecutionContext) => Promise<number> | number;
type CacheTTLArgumentFactory = (args: any[]) => Promise<number> | number;

/**
 * Decorator that sets the cache ttl setting the duration for cache expiration.
 *
 * For example: `@CacheTTL(5)`
 *
 * @param ttl number set the cache expiration time
 *
 * @see [Caching](https://docs.nestjs.com/techniques/caching)
 *
 * @publicApi
 */
export function CacheTTL(ttl: number): MethodDecorator & ClassDecorator;
export function CacheTTL(ttl: CacheTTLExecutionContextFactory): MethodDecorator & ClassDecorator;
export function CacheTTL(ttl: CacheTTLArgumentFactory): MethodDecorator & ClassDecorator;
export function CacheTTL(ttl: number | CacheTTLExecutionContextFactory | CacheTTLArgumentFactory) {
  if (isNil(ttl)) {
    throw new Error('CacheTTL requires a valid ttl but received an empty or undefined value.');
  }
  return (target: any, propertyKey: any, propertyDescriptor: any) => {
    return SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, propertyDescriptor);
  };
}
