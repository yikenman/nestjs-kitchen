import { getAllowAnonymous } from './get-allow-anonymous';
import type { AuthzMetaParams } from './types';

describe('Get allow anonymous', () => {
  it('should return true if defaultAllowAnonymous is true in options', () => {
    const result = getAllowAnonymous([], { defaultAllowAnonymous: true });
    expect(result).toBe(true);
  });

  it('should return false if defaultAllowAnonymous is false and authzMetaCollection is empty', () => {
    const result = getAllowAnonymous([], { defaultAllowAnonymous: false });
    expect(result).toBe(false);
  });

  it('should return true if the last item in authzMetaCollection has allowAnonymous set to true', () => {
    const authzMetaCollection: AuthzMetaParams[] = [{ options: { allowAnonymous: true } }];
    const result = getAllowAnonymous(authzMetaCollection);
    expect(result).toBe(true);
  });

  it('should return false if allowAnonymous is not set in any item of authzMetaCollection', () => {
    const authzMetaCollection: AuthzMetaParams[] = [{ options: {} }];
    const result = getAllowAnonymous(authzMetaCollection);
    expect(result).toBe(false);
  });

  it('should prioritize options.defaultAllowAnonymous over authzMetaCollection values', () => {
    const authzMetaCollection: AuthzMetaParams[] = [{ options: { allowAnonymous: false } }];
    const result = getAllowAnonymous(authzMetaCollection, { defaultAllowAnonymous: true });
    expect(result).toBe(true);
  });

  it('should return true if options.defaultAllowAnonymous is false but authzMetaCollection has allowAnonymous set to true', () => {
    const authzMetaCollection: AuthzMetaParams[] = [{ options: { allowAnonymous: true } }];
    const result = getAllowAnonymous(authzMetaCollection, { defaultAllowAnonymous: false });
    expect(result).toBe(true);
  });
});
