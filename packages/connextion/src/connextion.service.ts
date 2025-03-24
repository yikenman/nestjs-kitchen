import { Inject, type Type, mixin } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ConnextionInstance } from './connextion.instance';
import { INJECT_TOKEN_ID, INSTANCE_TOKEN_MAP } from './constants';
import { ConnextionError } from './errors';
import { type ConnectionOptionName, type OmitClassInstance } from './utils';

const preserveProps = new Set([
  'beforeApplicationShutdown',
  'onApplicationBootstrap',
  'onApplicationShutdown',
  'onModuleDestroy',
  'onModuleInit',
  'then',
  'instanceTokens'
]);

const forbiddenProps = new Set(['_cache', '_injectTokenId', '_moduleRef', '_getInjectedInstance']);

export const createConnextionService = <N extends string, I>() => {
  class Connextion {
    _cache: Record<string, I | undefined | Error> = {};

    constructor(
      @Inject(INJECT_TOKEN_ID)
      readonly _injectTokenId: string,
      @Inject(INSTANCE_TOKEN_MAP)
      readonly instanceTokens: Readonly<Record<string, string>>,
      @Inject()
      readonly _moduleRef: ModuleRef
    ) {
      return new Proxy(this, {
        get(target, prop: string) {
          if (forbiddenProps.has(prop)) {
            return undefined;
          }

          if (target['instanceTokens']?.[prop] && !preserveProps.has(prop)) {
            return target._getInjectedInstance(target['instanceTokens'][prop]);
          }

          return target[prop];
        }
      });
    }

    _getInjectedInstance(instanceToken: string) {
      if (!this._cache[instanceToken]) {
        try {
          this._cache[instanceToken] = this._moduleRef.get<I>(instanceToken, { strict: true });
        } catch (error) {
          this._cache[instanceToken] = new ConnextionError(`Service with name ${instanceToken} not found`, {
            cause: error
          });
        }
      }

      if (this._cache[instanceToken] instanceof Error) {
        throw this._cache[instanceToken];
      }

      return this._cache[instanceToken];
    }
  }

  return mixin(
    Connextion as Type<
      Record<ConnectionOptionName<N>, InstanceType<OmitClassInstance<Type<I>, keyof ConnextionInstance<unknown>>>>
    >
  );
};
