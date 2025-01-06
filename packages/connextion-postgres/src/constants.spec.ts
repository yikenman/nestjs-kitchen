import {
  ALS,
  CONNEXTION_POSTGRES_DEBUG,
  DATE_FORMAT,
  DEFAULT_INSTANCE_NAME,
  GET_CLIENT,
  MAX_LENGTH
} from './constants';

describe('Constants', () => {
  it('should have the correct ALS type', () => {
    expect(typeof ALS).toBe('symbol');
  });
  it('should have the correct CONNEXTION_POSTGRES_DEBUG type', () => {
    expect(typeof CONNEXTION_POSTGRES_DEBUG).toBe('string');
  });
  it('should have the correct DEFAULT_INSTANCE_NAME type', () => {
    expect(typeof DEFAULT_INSTANCE_NAME).toBe('string');
  });
  it('should have the correct GET_CLIENT type', () => {
    expect(typeof GET_CLIENT).toBe('symbol');
  });
  it('should have the correct MAX_LENGTH type', () => {
    expect(typeof MAX_LENGTH).toBe('number');
  });
  it('should have the correct DATE_FORMAT type', () => {
    expect(typeof DATE_FORMAT).toBe('string');
  });
});
