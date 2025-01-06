import * as exportedModules from './index';

describe('Module Exports', () => {
  it('should export ConnextionInstance', () => {
    expect(exportedModules.ConnextionInstance).toBeDefined();
    expect(typeof exportedModules.ConnextionInstance).toBe('function');
  });

  it('should export defineConnextionBuilder', () => {
    expect(exportedModules.defineConnextionBuilder).toBeDefined();
    expect(typeof exportedModules.defineConnextionBuilder).toBe('function');
  });

  it('should export ConnextionError', () => {
    expect(exportedModules.ConnextionError).toBeDefined();
    expect(typeof exportedModules.ConnextionError).toBe('function');
  });
});
