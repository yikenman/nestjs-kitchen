import type { applyDecorators } from '@nestjs/common';
import type { RouteInfo, Type } from '@nestjs/common/interfaces';
import type { CookieOptions } from 'express';
import type { AuthzProviderClass } from '../authz.provider';

export type OmitClassInstance<T extends abstract new (...args: any) => any, K extends keyof any> = Type<
  Omit<InstanceType<T>, K>
>;

export type SetRequired<T, K extends keyof T> = T & {
  [P in K]-?: NonNullable<T[P]>;
};

export type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type IsNull<T> = [T] extends [null] ? true : false;

export type IsUnknown<T> = unknown extends T // `T` can be `unknown` or `any`
  ? IsNull<T> extends false // `any` can be `null`, but `unknown` can't be
    ? true
    : false
  : false;

export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

export type CookieOptionsWithSecret = CookieOptions & {
  /**
   * a string or array used to sign cookies.
   */
  secret?: string | string[];
};

export interface AuthzDecoBaseOptions {
  /**
   * When set, overrides the previous metadatas during the authorization, instead of inheriting.
   */
  override?: boolean;
  /**
   * When set, authorization & authentication will be bypassed if authentication returns empty.
   */
  allowAnonymous?: boolean;
}

export interface AuthzDecoOptions extends AuthzDecoBaseOptions {
  public?: boolean;
}

export interface AuthzMetaParams {
  metaData?: unknown;
  options?: AuthzDecoOptions;
}

export type AuthzDecoParams<MetaData> = IsUnknown<MetaData> extends false
  ? IncludesUndefined<MetaData> extends false
    ? [metaData: MetaData, options?: AuthzDecoBaseOptions]
    : IsEqual<MetaData, undefined> extends false
      ? [metaData?: MetaData, options?: AuthzDecoBaseOptions]
      : [options?: AuthzDecoBaseOptions]
  : [options?: AuthzDecoBaseOptions];

export type SingleOrArray<T> = T | T[];

export type IncludesUndefined<T> = undefined extends T ? true : false;

export type AbstractConstructor<T, T1, T2> = new (...args: any[]) => T & AuthzProviderClass<T1, T2>;

export type MethodParameters<T, Method extends keyof T> = T[Method] extends (...args: infer P) => any ? P : never;

export interface AuthzModuleBaseOptions {
  /**
   * Property name for registering authenticated user on the HTTP request object.
   *
   * @default 'user'
   */
  passportProperty: string;
  /**
   * When set, the current metadata will override previous metadatas during the authorization by default, instead of inheriting.
   *
   * @default false
   */
  defaultOverride: boolean;
  /**
   * When set, empty metadata will be `ignored` by default during the authorization.
   *
   * @default false
   */
  skipFalsyMetadata: boolean;
  /**
   * When set, authorization & authentication will be bypassed by default if authentication returns empty.
   *
   * @default false
   */
  defaultAllowAnonymous: boolean;
}

export type AuthzModuleRoutesOptions = {
  /**
   * When enabled, becomes a global module and will apply strategy to all routes in the application.
   *
   * Note: This option conflicts with the `routes` option.
   *
   * @default false
   */
  global?: boolean;
  /**
   * Applies strategy to the specified controllers/routes.
   *
   * Note: This option conflicts with the `global` option.
   */
  routes?: SingleOrArray<string | Type | RouteInfo>;
  /**
   * Whitelists the specified controllers/routes listed in `routes` options.
   */
  excludes?: SingleOrArray<string | RouteInfo>;
};

export type RoutesOptions = {
  global: boolean;
  routes: (string | Type | RouteInfo)[];
  excludes: (string | RouteInfo)[];
};

export type ApplyDecorators = ReturnType<typeof applyDecorators>;
