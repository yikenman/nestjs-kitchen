import type { AsyncLocalStorage } from 'node:async_hooks';
import { AuthzError } from '../errors';

export const getAlsStore = <T>(als: AsyncLocalStorage<T>) => {
  const store = als.getStore();
  if (!store) {
    throw new AuthzError(`InternalError: Unable to retrieve user data`);
  }
  return store;
};
