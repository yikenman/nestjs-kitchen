import { PrestoError } from './errors';

describe('Errors', () => {
  describe('PrestoError', () => {
    it('should return an instance', () => {
      const instance = new PrestoError();
      expect(instance).toBeInstanceOf(PrestoError);
    });
  });
});
