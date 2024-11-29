import { decodeMsgpackrString, encodeMsgpackrString } from './msgpackrs';

describe('Msgpackr', () => {
  it('should encode an object to a base64 msgpack string', () => {
    const payload = { name: 'Test', age: 30 };
    const encoded = encodeMsgpackrString(payload);

    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('should decode a base64 msgpack string back to the original object', () => {
    const payload = { name: 'Test', age: 30 };
    const encoded = encodeMsgpackrString(payload);
    const decoded = decodeMsgpackrString<typeof payload>(encoded);

    expect(decoded).toEqual(payload);
  });

  it('should throw an error for invalid base64 input during decoding', () => {
    const invalidInput = 'invalidBase64String';

    expect(() => decodeMsgpackrString(invalidInput)).toThrow();
  });
});
