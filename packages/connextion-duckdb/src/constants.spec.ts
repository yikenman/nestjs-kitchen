import { CONNEXTION_DUCKDB_DEBUG, DEFAULT_INSTANCE_NAME, MAX_LENGTH } from './constants';

describe('Constants', () => {
  it('should have the correct DEFAULT_INSTANCE_NAME type', () => {
    expect(typeof DEFAULT_INSTANCE_NAME).toBe('string');
  });
  it('should have the correct MAX_LENGTH type', () => {
    expect(typeof MAX_LENGTH).toBe('number');
  });
  it('should have the correct CONNEXTION_DUCKDB_DEBUG type', () => {
    expect(typeof CONNEXTION_DUCKDB_DEBUG).toBe('string');
  });
});
