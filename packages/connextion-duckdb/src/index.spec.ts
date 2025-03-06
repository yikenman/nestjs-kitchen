import * as exportedModules from './index';

describe('Module Exports', () => {
  it('should export defineDuckDB', () => {
    expect(exportedModules.defineDuckDB).toBeDefined();
    expect(typeof exportedModules.defineDuckDB).toBe('function');
  });
  it('should export DuckDBError', () => {
    expect(exportedModules.DuckDBError).toBeDefined();
    expect(typeof exportedModules.DuckDBError).toBe('function');
  });
});
