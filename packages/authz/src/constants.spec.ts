import {
  DEFAULT_PASSPORT_PROPERTY_VALUE,
  JwtValidationType,
  PASSPORT_PROPERTY,
  PREFIX,
  ROUTES_OPTIONS,
  SESSION_PASSPORT_KEY
} from './constants';

describe('Constants', () => {
  it('should export DEFAULT_PASSPORT_PROPERTY_VALUE as a string', () => {
    expect(typeof DEFAULT_PASSPORT_PROPERTY_VALUE).toBe('string');
  });

  it('should export PREFIX as s string', () => {
    expect(typeof PREFIX).toBe('string');
  });

  it('should export SESSION_PASSPORT_KEY as s string', () => {
    expect(typeof SESSION_PASSPORT_KEY).toBe('string');
  });

  it('should export PASSPORT_PROPERTY as a Symbol', () => {
    expect(typeof PASSPORT_PROPERTY).toBe('symbol');
  });

  it('should export ROUTES_OPTIONS as a Symbol', () => {
    expect(typeof ROUTES_OPTIONS).toBe('symbol');
  });

  it('should export JwtValidationType', () => {
    expect(JwtValidationType).toBeDefined();
    expect(JwtValidationType.JWT).toBe(0);
    expect(JwtValidationType.REFRESH).toBe(1);
  });
});
