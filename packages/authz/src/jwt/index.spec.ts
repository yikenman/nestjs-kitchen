import * as index from './index';

describe('Index', () => {
  it('should export allowed modules', () => {
    expect(index).toHaveProperty('ExtractJwt');
    expect(index).toHaveProperty('createJwtAuthzModule');
  });
});
