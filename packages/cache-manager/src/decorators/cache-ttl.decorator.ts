import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { isNil } from '@nestjs/common/utils/shared.utils';
import { CACHE_TTL_METADATA } from '../cache.constants';

type CacheTTLExecutionContextFactory = (ctx: ExecutionContext) => Promise<number> | number;
type CacheTTLArgumentFactory = (args: any[]) => Promise<number> | number;

/**
 * Decorator that sets the cache TTL (time-to-live) duration for cache expiration.
 *
 * Supports both static numeric values and dynamic TTL values via a callback function.
 *
 * - When applied to HTTP, WebSocket, Microservice, or GraphQL methods, the callback receives an `ExecutionContext` as an argument.
 * - When applied to regular methods, the callback receives the corresponding method parameters.
 *
 * @example
 * ```typescript
 * ⁣@CacheTTL(5) // Static TTL of 5 seconds
 * async fetchData() { ... }
 *
 * ⁣@CacheTTL((context: ExecutionContext) => context.getHandler().name === 'fastQuery' ? 2 : 10)
 * async fetchDataWithDynamicTTL() { ... }
 *
 * ⁣@CacheTTL((args: any[]) => args[0] > 10 ? 30 : 60) // TTL based on first argument
 * async getItemById(id: number) { ... }
 * ```
 *
 * @param ttl A static number or a callback function that dynamically determines the cache expiration time.
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
