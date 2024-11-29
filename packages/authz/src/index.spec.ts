import * as index from './index';

describe('Index', () => {
  it('should export allowed modules', () => {
    expect(index).toHaveProperty('AuthzProviderClass');
    expect(index).toHaveProperty('User');
    expect(index).toHaveProperty('AuthzError');
    expect(index).toHaveProperty('AuthzVerificationError');
    expect(index).toHaveProperty('ExtractJwt');
    expect(index).toHaveProperty('createJwtAuthzModule');
    expect(index).toHaveProperty('cereateSessionAuthzModule');
  });
});
