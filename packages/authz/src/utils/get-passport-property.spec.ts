import type { Request } from 'express';
import { PASSPORT_PROPERTY } from '../constants';
import { getPassportProperty } from './get-passport-property';

describe('Get passport property', () => {
  it('should return the value from the request based on PASSPORT_PROPERTY', () => {
    const mockRequest = {
      [PASSPORT_PROPERTY]: 'userProperty',
      userProperty: { id: 1, name: 'Test User' }
    } as unknown as Request;

    const result = getPassportProperty(mockRequest);

    expect(result).toEqual({ id: 1, name: 'Test User' });
  });

  it('should return undefined if PASSPORT_PROPERTY is not set on request', () => {
    const mockRequest = {} as unknown as Request;

    const result = getPassportProperty(mockRequest);

    expect(result).toBeUndefined();
  });

  it('should return undefined if value is undefined', () => {
    const mockRequest = {
      [PASSPORT_PROPERTY]: 'userProperty'
    } as unknown as Request;

    const result = getPassportProperty(mockRequest);

    expect(result).toBeUndefined();
  });
});
