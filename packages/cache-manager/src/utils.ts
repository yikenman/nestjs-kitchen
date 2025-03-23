import { PATH_METADATA } from '@nestjs/common/constants';
import { hasher } from 'node-object-hash';
import {
  CACHE_RESULT_METADATA,
  DEFAULT_ARGS_ALG,
  GRAPHQL_META_PREFIX,
  MICROSERVICES_META_PREFIX,
  WEBSOCKETS_META_PREFIX
} from './cache.constants';

export const copyMethodMetadata = (from: any, to: any) => {
  const metadataKeys = Reflect.getMetadataKeys(from);
  metadataKeys.map((key) => {
    const value = Reflect.getMetadata(key, from);
    Reflect.defineMetadata(key, value, to);
  });
};

export const getCacheResultMetdata = (target: any) => {
  return Reflect.getMetadata(CACHE_RESULT_METADATA, target);
};

export const setCacheResultMetdata = (target: any) => {
  return Reflect.defineMetadata(CACHE_RESULT_METADATA, true, target);
};

export const isValidMethod = (target: any) => {
  const metadataKeys: string[] = Reflect.getMetadataKeys(target);
  return !metadataKeys.some(
    (key) =>
      key === PATH_METADATA ||
      key.startsWith(WEBSOCKETS_META_PREFIX) ||
      key.startsWith(MICROSERVICES_META_PREFIX) ||
      key.startsWith(GRAPHQL_META_PREFIX)
  );
};

export const getMetadata = <T>(key: string, targets: any[] = []): T | undefined => {
  for (let i = 0; i < targets.length; i++) {
    const metadata = Reflect.getMetadata(key, targets[i]);
    if (metadata !== undefined) {
      return metadata;
    }
  }

  return undefined;
};

export const hashNoCoerce = hasher({
  coerce: false,
  alg: DEFAULT_ARGS_ALG
});
