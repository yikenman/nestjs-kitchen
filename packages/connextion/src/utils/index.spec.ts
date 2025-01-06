import * as exportedModules from './index';

describe('Module Exports', () => {
  it('should export createAsyncProviders', () => {
    expect(exportedModules.createAsyncProviders).toBeDefined();
    expect(typeof exportedModules.createAsyncProviders).toBe('function');
  });

  it('should export normalizeConnections', () => {
    expect(exportedModules.normalizeConnections).toBeDefined();
    expect(typeof exportedModules.normalizeConnections).toBe('function');
  });

  it('should export joinStrs', () => {
    expect(exportedModules.joinStrs).toBeDefined();
    expect(typeof exportedModules.joinStrs).toBe('function');
  });

  it('should export mixinModule', () => {
    expect(exportedModules.mixinModule).toBeDefined();
    expect(typeof exportedModules.mixinModule).toBe('function');
  });
});
