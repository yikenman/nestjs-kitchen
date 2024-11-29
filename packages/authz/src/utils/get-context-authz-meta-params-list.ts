import { isNotFalsy } from './generics';
import type { AuthzMetaParams } from './types';

export const getContextAuthzMetaParamsList = (
  authzMetaCollection: AuthzMetaParams[],
  options?: {
    defaultOverride?: boolean;
    skipFalsyMetadata?: boolean;
  }
) => {
  const lastOverrideIdx = options?.defaultOverride
    ? authzMetaCollection.length - 1
    : authzMetaCollection.findLastIndex((ele) => ele?.options?.override);

  const contextAuthzMetaCollection = authzMetaCollection
    .slice(lastOverrideIdx === -1 ? 0 : lastOverrideIdx)
    .filter((ele) => !ele.options?.public);

  if (options?.skipFalsyMetadata) {
    return contextAuthzMetaCollection.filter((ele) => isNotFalsy(ele.metaData));
  }

  return contextAuthzMetaCollection;
};
