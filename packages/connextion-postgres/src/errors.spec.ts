import { PostgresError } from './errors';

describe('Errors', () => {
  describe('PostgresError', () => {
    it('should return an instance', () => {
      const instance = new PostgresError();
      expect(instance).toBeInstanceOf(PostgresError);
    });
  });
});
