import type { Format } from 'mybatis-mapper';
import type { GlobOptions } from 'tinyglobby';

export type MybatisMapperModuleOptions = Omit<GlobOptions, 'onlyDirectories' | 'onlyFiles'> & {
  format?: Format;
  watchPatterns?: GlobOptions['patterns'];
};
