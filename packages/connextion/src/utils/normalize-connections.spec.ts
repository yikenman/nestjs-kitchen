import { DEFAULT_INSTANCE_NAME } from '../constants';
import { normalizeConnections } from './normalize-connections';

jest.spyOn(console, 'warn').mockImplementation(() => {});

type MockInputType = {
  name?: string;
  someOption?: string;
  anotherOption?: string;
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('normalizeConnections', () => {
  it('should handle a single connection object and assign default name', () => {
    const input: MockInputType = { someOption: 'value' };
    const result = normalizeConnections(input);

    expect(result).toEqual([[DEFAULT_INSTANCE_NAME, { someOption: 'value' }]]);
  });

  it('should handle an array of connection objects and assign default name', () => {
    const input: MockInputType[] = [{ someOption: 'value' }, { anotherOption: 'value2' }];
    const result = normalizeConnections(input);

    expect(result).toEqual([[DEFAULT_INSTANCE_NAME, { anotherOption: 'value2' }]]);
  });

  it('should assign the provided defaultName when name is not present', () => {
    const input: MockInputType = { someOption: 'value' };
    const result = normalizeConnections(input, 'customName');

    expect(result).toEqual([['customName', { someOption: 'value' }]]);
  });

  it('should assign the provided defaultName to each connection in the array', () => {
    const input: MockInputType[] = [{ someOption: 'value' }, { anotherOption: 'value2' }];
    const result = normalizeConnections(input, 'customName');

    expect(result).toEqual([['customName', { anotherOption: 'value2' }]]);
  });

  it('should handle object with name and use name property if present', () => {
    const input: MockInputType = { name: 'providedName', someOption: 'value' };
    const result = normalizeConnections(input);

    expect(result).toEqual([[input.name, { someOption: 'value' }]]);
  });

  it('should handle object array with name and use name property if present', () => {
    const input: MockInputType[] = [
      { name: 'providedName', someOption: 'value' },
      { name: 'anotherName', anotherOption: 'value2' }
    ];
    const result = normalizeConnections(input, 'customName');

    expect(result).toEqual([
      [input[0].name, { someOption: 'value' }],
      [input[1].name, { anotherOption: 'value2' }]
    ]);
  });

  it('should warn when there are duplicate connection names', () => {
    const input: MockInputType[] = [
      { name: 'duplicateName', someOption: 'value' },
      { name: 'duplicateName', anotherOption: 'value2' }
    ];

    normalizeConnections(input);

    // Should call console.warn once due to duplicate names
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
