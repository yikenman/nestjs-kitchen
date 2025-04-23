import { MybatisMapperError } from './errors';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Errors', () => {
  describe('MybatisMapperError', () => {
    it('should return an instance', () => {
      const instance = new MybatisMapperError();
      expect(instance).toBeInstanceOf(MybatisMapperError);
    });

    it('should accept Error type as arguments', () => {
      const err = new Error('test message');
      const instance = new MybatisMapperError(err);
      expect(instance.message).toBe(err.message);
    });

    it('should accept string type as arguments', () => {
      const err = 'test message';
      const instance = new MybatisMapperError(err);
      expect(instance.message).toBe(err);
    });
  });
});
