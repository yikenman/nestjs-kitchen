import { getAdaptorMethods, isEmptyObjectShallow } from './utils';

describe('isEmptyObjectShallow', () => {
  it('should return false for null or undefined', () => {
    expect(isEmptyObjectShallow(null as any)).toBe(false);
    expect(isEmptyObjectShallow(undefined as any)).toBe(false);
  });

  it('should return false for non-object types', () => {
    expect(isEmptyObjectShallow(123 as any)).toBe(false);
    expect(isEmptyObjectShallow('string' as any)).toBe(false);
  });

  it('should return true for empty object', () => {
    expect(isEmptyObjectShallow({})).toBe(true);
  });

  it('should return true if all properties are undefined', () => {
    expect(isEmptyObjectShallow({ a: undefined, b: undefined })).toBe(true);
  });

  it('should return false if at least one property has value', () => {
    expect(isEmptyObjectShallow({ a: 1, b: undefined })).toBe(false);
    expect(isEmptyObjectShallow({ a: null })).toBe(false);
    expect(isEmptyObjectShallow({ a: false })).toBe(false);
  });
});

describe('getAdaptorMethods', () => {
  it('should return ExpressAdapter methods', () => {
    const methods = getAdaptorMethods('ExpressAdapter');
    const req = { foo: 'bar' };
    const res = { baz: 'qux' };

    expect(methods.getRawRequest(req)).toBe(req);
    expect(methods.getRawRespone(res)).toBe(res);
  });

  it('should return FastifyAdapter methods', () => {
    const methods = getAdaptorMethods('FastifyAdapter');
    const req = { raw: { foo: 'bar' } };
    const res = { raw: { baz: 'qux' } };

    expect(methods.getRawRequest(req)).toBe(req.raw);
    expect(methods.getRawRespone(res)).toBe(res.raw);
  });

  it('should return undefined for unknown adaptor', () => {
    expect(getAdaptorMethods('UnknownAdaptor')).toBeUndefined();
  });
});
