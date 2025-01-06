import * as exportedModules from './index';

describe('Module Exports', () => {
  it('should export definePostgres', () => {
    expect(exportedModules.definePostgres).toBeDefined();
    expect(typeof exportedModules.definePostgres).toBe('function');
  });
  it('should export PostgresError', () => {
    expect(exportedModules.PostgresError).toBeDefined();
    expect(typeof exportedModules.PostgresError).toBe('function');
  });
});
