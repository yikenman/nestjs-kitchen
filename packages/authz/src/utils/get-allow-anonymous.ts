import type { AuthzMetaParams } from './types';

export const getAllowAnonymous = (
  authzMetaCollection: AuthzMetaParams[],
  options?: {
    defaultAllowAnonymous?: boolean;
  }
) => {
  return (
    options?.defaultAllowAnonymous ||
    Boolean(authzMetaCollection[authzMetaCollection.length - 1]?.options?.allowAnonymous)
  );
};
