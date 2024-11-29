import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthzError } from '../errors';
import { getAlsStore } from './get-als-store';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Get ALS store', () => {
  let als: AsyncLocalStorage<Record<string, any>>;

  beforeEach(() => {
    als = new AsyncLocalStorage();
  });

  it('should return the store if it exists', () => {
    const mockStore = { user: 'testUser' };
    als.run(mockStore, () => {
      const result = getAlsStore(als);
      expect(result).toBe(mockStore);
    });
  });

  it('should throw an AuthzError if the store is not available', () => {
    expect(() => getAlsStore(als)).toThrow(new AuthzError('InternalError: Unable to retrieve user data'));
  });
});
