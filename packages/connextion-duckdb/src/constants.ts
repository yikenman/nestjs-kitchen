export const DEFAULT_INSTANCE_NAME = 'default';
// Answer to the universe.
export const MAX_LENGTH = 42;
// Env debug flag
export const CONNEXTION_DUCKDB_DEBUG = 'CONNEXTION_DUCKDB_DEBUG';

export const DuckDBResultAsyncMethods = new Set([
  'fetchChunk',
  'fetchAllChunks',
  'getColumns',
  'getColumnsJson',
  'getColumnsObject',
  'getColumnsObjectJson',
  'getRows',
  'getRowsJson',
  'getRowObjects',
  'getRowObjectsJson'
]);

export const DuckDBResultReaderAsyncMethods = new Set(['readAll', 'readUntil']);
