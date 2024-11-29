import { AuthzProviderClass } from './authz.provider';

class TestableClass extends AuthzProviderClass<unknown, unknown> {
  createPayload(user: unknown): unknown {
    return user;
  }

  authenticate(payload: unknown): unknown {
    return payload;
  }
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Authz Provider', () => {
  let instance: TestableClass;

  beforeEach(() => {
    instance = new TestableClass();
  });

  describe('AuthzProviderClass', () => {
    it('should implement createPayload', () => {
      const user = { id: 'testId' };
      expect(instance.createPayload(user)).toBe(user);
    });

    it('should implement authenticate', () => {
      const payload = { id: 'testId' };
      expect(instance.authenticate(payload)).toBe(payload);
    });

    it('should implement authorize', () => {
      expect(instance.authorize({})).toBe(true);
    });
  });
});
