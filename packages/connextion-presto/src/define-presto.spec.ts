import { defineConnextionBuilder } from '@nestjs-kitchen/connextion';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { definePresto } from './define-presto';
import { PrestoInstance } from './presto.instance';

jest.mock('@nestjs-kitchen/connextion', () => {
  const actual = jest.requireActual('@nestjs-kitchen/connextion');
  return {
    ...actual,
    defineConnextionBuilder: jest.fn(actual.defineConnextionBuilder)
  };
});

describe('definePresto', () => {
  it('should call defineConnextionBuilder with correct arguments', () => {
    expect(defineConnextionBuilder).toHaveBeenCalledTimes(1);
    expect(defineConnextionBuilder).toHaveBeenCalledWith({
      connextionName: 'Presto',
      InstanceClass: PrestoInstance,
      defaultInstanceName: DEFAULT_INSTANCE_NAME
    });
  });

  it('should export definePresto', () => {
    expect(typeof definePresto).toBe('function');
  });

  it('should return the correct structure', () => {
    const result = definePresto();

    expect(result).toHaveProperty('Presto', expect.any(Function));
    expect(result).toHaveProperty('PrestoModule', expect.any(Function));
  });
});
