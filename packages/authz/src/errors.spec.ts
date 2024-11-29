import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from './errors';

describe('Errors', () => {
  describe('AuthzError', () => {
    it('should return an instance', () => {
      const instance = new AuthzError();
      expect(instance).toBeInstanceOf(AuthzError);
    });
  });

  describe('AuthzAnonymousError', () => {
    it('should return an instance', () => {
      const instance = new AuthzAnonymousError();
      expect(instance).toBeInstanceOf(AuthzAnonymousError);
    });
  });

  describe('AuthzVerificationError', () => {
    it('should return an instance', () => {
      const instance = new AuthzVerificationError();
      expect(instance).toBeInstanceOf(AuthzVerificationError);
    });
  });
});
