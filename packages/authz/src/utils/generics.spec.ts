import { isNotFalsy, normalizedArray, normalizedObject } from './generics';

describe('Generics', () => {
  describe('isNotFalsy', () => {
    it('should return true with truthy value', () => {
      const values = [0, '', 1, '1', {}, false];
      values.forEach((val) => {
        expect(isNotFalsy(val)).toBe(true);
      });
    });
    it('should return true with falsy value', () => {
      const values = [null, undefined, NaN];
      values.forEach((val) => {
        expect(isNotFalsy(val)).toBe(false);
      });
    });
  });

  describe('normalizedArray', () => {
    it('should return undefined when the input is undefined', () => {
      expect(normalizedArray()).toBeUndefined();
    });

    it('should return an array with the single element when input is not an array', () => {
      expect(normalizedArray('single')).toEqual(['single']);
    });

    it('should return the input array when the input is already an array', () => {
      expect(normalizedArray(['item1', 'item2'])).toEqual(['item1', 'item2']);
    });
  });

  describe('normalizedObject', () => {
    it('should return undefined when the input object is undefined', () => {
      expect(normalizedObject(undefined)).toBeUndefined();
    });

    it('should return undefined for an empty object', () => {
      expect(normalizedObject({})).toBeUndefined();
    });

    it('should return undefined if all object values are undefined', () => {
      expect(normalizedObject({ a: undefined, b: undefined })).toBeUndefined();
    });

    it('should filter out undefined values from the object', () => {
      const input = { a: 1, b: undefined, c: 3 };
      const expectedOutput = { a: 1, c: 3 };
      expect(normalizedObject(input)).toEqual(expectedOutput);
    });

    it('should return the same object if there are no undefined values', () => {
      const input = { a: 1, b: 2 };
      expect(normalizedObject(input)).toEqual(input);
    });
  });
});
