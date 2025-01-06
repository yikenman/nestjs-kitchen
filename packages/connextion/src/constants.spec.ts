import { DEFAULT_INSTANCE_NAME, INJECT_TOKEN_ID, PREFIX } from './constants';

describe('Constants', () => {
  it('should have the correct DEFAULT_INSTANCE_NAME value', () => {
    expect(typeof DEFAULT_INSTANCE_NAME).toBe('string');
  });

  it('should have the correct PREFIX value', () => {
    expect(typeof PREFIX).toBe('string');
  });

  it('should have the correct INJECT_TOKEN_ID value', () => {
    expect(typeof INJECT_TOKEN_ID).toBe('symbol');
  });
});
