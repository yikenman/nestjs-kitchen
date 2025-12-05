import { isEmptyObject } from './utils';

describe('isEmptyObject', () => {
  it('should return true for undefined', () => {
    expect(isEmptyObject(undefined)).toBe(true);
  });

  it('should return true for null', () => {
    expect(isEmptyObject(null)).toBe(true);
  });

  it('should return false for non-object types', () => {
    expect(isEmptyObject(123)).toBe(false);
    expect(isEmptyObject('abc')).toBe(false);
    expect(isEmptyObject(true)).toBe(false);
    expect(isEmptyObject(Symbol())).toBe(false);
    expect(isEmptyObject(() => {})).toBe(false); // functions
  });

  it('should return false for arrays', () => {
    expect(isEmptyObject([])).toBe(false);
    expect(isEmptyObject([1, 2, 3])).toBe(false);
  });

  it('should return true for empty object {}', () => {
    expect(isEmptyObject({})).toBe(true);
  });

  it('should return true for object with only undefined values', () => {
    expect(isEmptyObject({ a: undefined })).toBe(true);
    expect(isEmptyObject({ a: undefined, b: undefined })).toBe(true);
  });

  it('should return false if object contains any defined value', () => {
    expect(isEmptyObject({ a: undefined, b: 1 })).toBe(false);
    expect(isEmptyObject({ a: 0 })).toBe(false);
    expect(isEmptyObject({ a: null })).toBe(false); // null is a valid value (not undefined)
    expect(isEmptyObject({ a: '' })).toBe(false);
  });

  it('should return true when object prototype has keys but own keys are empty', () => {
    const obj = Object.create({ a: 1 });
    expect(isEmptyObject(obj)).toBe(true);
  });

  it('should handle nested objects: only check top-level keys', () => {
    expect(isEmptyObject({ nested: {} })).toBe(false);
    expect(isEmptyObject({ nested: { a: undefined } })).toBe(false);
  });
});
``;
