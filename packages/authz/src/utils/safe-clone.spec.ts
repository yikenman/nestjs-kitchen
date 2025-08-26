import { safeClone } from './safe-clone';

describe('safeClone', () => {
  it('should return {} when input is null', () => {
    expect(safeClone(null)).toEqual({});
  });

  it('should return {} when input is undefined', () => {
    expect(safeClone(undefined)).toEqual({});
  });

  it('should deep clone a simple object', () => {
    const obj = { a: 1, b: { c: 2 } };
    const clone = safeClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.b).not.toBe(obj.b);
  });

  it('should deep clone an array', () => {
    const arr = [1, { a: 2 }];
    const clone = safeClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
    expect(clone[1]).not.toBe(arr[1]);
  });

  it('should return {} when object contains BigInt', () => {
    const obj = { a: BigInt(123) };
    expect(safeClone(obj)).toEqual({});
  });

  it('should return {} when object has circular reference', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    expect(safeClone(obj)).toEqual({});
  });
});
