import { DuckDBError } from './errors';

describe('Errors', () => {
  describe('PrestoError', () => {
    it('should return an instance', () => {
      const instance = new DuckDBError();
      expect(instance).toBeInstanceOf(DuckDBError);
    });
  });
});
