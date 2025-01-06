import { joinStrs } from './join-strs';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('joinStrs', () => {
  it('should join multiple non-empty strings with an underscore', () => {
    const result = joinStrs('apple', 'banana', 'cherry');
    expect(result).toBe('apple_banana_cherry');
  });

  it('should ignore empty strings', () => {
    const result = joinStrs('apple', '', 'cherry');
    expect(result).toBe('apple_cherry');
  });

  it('should ignore null and undefined values', () => {
    // @ts-ignore
    const result = joinStrs('apple', null, 'cherry', undefined);
    expect(result).toBe('apple_cherry');
  });

  it('should return an empty string if no arguments are passed', () => {
    const result = joinStrs();
    expect(result).toBe('');
  });

  it('should return the string itself if only one argument is passed', () => {
    const result = joinStrs('apple');
    expect(result).toBe('apple');
  });

  it('should join repeated non-empty strings with an underscore', () => {
    const result = joinStrs('apple', 'apple', 'apple');
    expect(result).toBe('apple_apple_apple');
  });
});
