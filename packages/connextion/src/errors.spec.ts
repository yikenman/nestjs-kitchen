import { ConnextionError } from './errors';

describe('Errors', () => {
  describe('ConnextionError', () => {
    it('should return an instance', () => {
      const instance = new ConnextionError();
      expect(instance).toBeInstanceOf(ConnextionError);
    });
  });
});
