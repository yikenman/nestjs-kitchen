import type { DynamicModule } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { hasher } from 'node-object-hash';
import { CACHE_RESULT_METADATA } from './cache.constants';

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
      key.startsWith('websockets:') ||
      key.startsWith('microservices:') ||
      key.startsWith('graphql:')
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

export const plainPromise = async <T>(promise: Promise<T> | T): Promise<[T, undefined] | [undefined, any]> => {
  let result: T | undefined = undefined;
  let err: unknown = undefined;

  try {
    result = await promise;
  } catch (error) {
    err = error;
  }

  return [result, err] as any;
};

export const hashNoCoerce = hasher({
  coerce: false,
  alg: 'md5'
});

export const mergeDynamicModuleConfigs = (...configs: Partial<DynamicModule>[]) => {
  const merged = configs.reduce<Partial<DynamicModule>>(
    (acc, curr) => ({
      global: acc?.global || curr?.global,
      module: acc?.module || curr?.module,
      imports: [...(acc?.imports || []), ...(curr?.imports || [])],
      controllers: [...(acc?.controllers || []), ...(curr?.controllers || [])],
      providers: [...(acc?.providers || []), ...(curr?.providers || [])],
      exports: [...(acc?.exports || []), ...(curr?.exports || [])]
    }),
    {}
  );

  return merged as DynamicModule;
};
