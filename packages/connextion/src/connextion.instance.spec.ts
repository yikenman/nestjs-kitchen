import { ConnextionInstance } from './connextion.instance';

class MockConnextionInstance extends ConnextionInstance<unknown> {
  dispose() {
    return 'disposed';
  }

  create(options: unknown) {
    return `created with ${options}`;
  }
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('ConnextionInstance', () => {
  let instance: MockConnextionInstance;

  beforeEach(() => {
    instance = new MockConnextionInstance('test-instance', { option1: 'value1' });
  });

  it('should instantiate with name and options', () => {
    expect(instance.name).toBe('test-instance');
    expect(instance['options']).toEqual({ option1: 'value1' });
  });

  describe('onModuleInit', () => {
    it('should call create with options when initialized', async () => {
      const createSpy = jest.spyOn(instance, 'create');

      // Call onModuleInit which should invoke create method
      await instance.onModuleInit();

      // Verify the create method is called with correct options and options are cleared
      expect(createSpy).toHaveBeenCalledWith({ option1: 'value1' });
      expect(instance['options']).toBeUndefined();
    });

    it('should not call create if options are undefined', async () => {
      const createSpy = jest.spyOn(instance, 'create');

      // Create instance without options
      const instanceWithoutOptions = new MockConnextionInstance('test-instance');
      await instanceWithoutOptions.onModuleInit();

      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call dispose when destroyed', () => {
      const disposeSpy = jest.spyOn(instance, 'dispose');

      // Call onModuleDestroy which should invoke dispose method
      instance.onModuleDestroy();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should return dispose result', () => {
      const result = instance.onModuleDestroy();

      expect(result).toBe('disposed');
    });
  });
});
