import { SetMetadata } from '@nestjs/common';
import { AuthzProviderClass } from '../authz.provider';
import type {
  ApplyDecorators,
  AuthzDecoBaseOptions,
  AuthzDecoParams,
  AuthzMetaParams,
  MethodParameters
} from './types';

const isOptions = (val: any): val is AuthzDecoBaseOptions => {
  if (!val) {
    return false;
  }
  const keySet = new Set(Object.keys(val));
  if (keySet.size === 1) {
    return keySet.has('override') || keySet.has('allowAnonymous');
  }
  if (keySet.size === 2) {
    return keySet.has('override') && keySet.has('allowAnonymous');
  }
  return false;
};

export const createAuthzDecoratorFactory =
  <T extends AuthzProviderClass<unknown, unknown>>(metaKey: string | Symbol) =>
  (...args: AuthzDecoParams<MethodParameters<T, 'authorize'>[1]>): ApplyDecorators => {
    const [metaDataOrOptions, optionsOrUndefined] = args;

    let metaData: unknown;
    let options: AuthzDecoBaseOptions | undefined;

    if (isOptions(metaDataOrOptions)) {
      options = metaDataOrOptions;
    } else {
      metaData = metaDataOrOptions;
      options = optionsOrUndefined;
    }

    return SetMetadata(metaKey, {
      metaData,
      options
    } as AuthzMetaParams);
  };
