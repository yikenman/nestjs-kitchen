import * as exportedModules from './index';

describe('Module Exports', () => {
  it('should export definePresto', () => {
    expect(exportedModules.definePresto).toBeDefined();
    expect(typeof exportedModules.definePresto).toBe('function');
  });
  it('should export PrestoError', () => {
    expect(exportedModules.PrestoError).toBeDefined();
    expect(typeof exportedModules.PrestoError).toBe('function');
  });
});
