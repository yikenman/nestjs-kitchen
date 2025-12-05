import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import chokidar, { type FSWatcher } from 'chokidar';
import mybatisMapper, { type Format, type Params } from 'mybatis-mapper';
import { matchBase } from 'picomatch';
import { globSync } from 'tinyglobby';
import { MybatisMapperError } from './errors';
import { MODULE_OPTIONS_TOKEN } from './module-builder';
import type { MybatisMapperModuleOptions } from './types';
import { isEmptyObject } from './utils';

const xmlPatten = '*.xml';

@Injectable()
export class MybatisMapper implements OnModuleInit, OnModuleDestroy {
  private watcher: FSWatcher;
  private logger: Logger;

  constructor(@Inject(MODULE_OPTIONS_TOKEN) private readonly options: MybatisMapperModuleOptions) {
    this.logger = new Logger(MybatisMapper.name);
  }

  private getXmls() {
    const { format, watchPatterns, ...globOptions } = this.options;

    if (!globOptions.patterns || !globOptions.patterns.length) {
      this.logger.verbose('No patterns provided — skipping XML mapper loading. Set `patterns` to load mappers.');
      return [];
    }

    return globSync(globOptions).filter((file) => matchBase(file, xmlPatten));
  }

  private getWatchFolders() {
    const { format, watchPatterns, ...globOptions } = this.options;

    if (!watchPatterns || !watchPatterns.length) {
      return [];
    }

    return globSync({ ...globOptions, patterns: watchPatterns, onlyDirectories: true });
  }

  private createMapper(path: string[]) {
    try {
      mybatisMapper.createMapper(path);
      path.forEach((ele) => this.logger.verbose(`Loading mappers from XML file: ${ele}`));
    } catch (error) {
      this.logger.error(`Failed to load mappers from files: ${error.message}`, error.stack);
    }
  }

  private initMapper() {
    const mapper: object = mybatisMapper.getMapper();
    Object.keys(mapper).forEach((k) => (mapper[k] = undefined));
    this.logger.verbose('Cleared existing MyBatis mapper cache...');

    this.createMapper(this.getXmls());
  }

  private onUnlink() {
    this.logger.debug(`XML file removed, reloading mappers...`);
    this.initMapper();
  }

  private onUpdate(path: string) {
    this.logger.debug(`XML file changes detected: ${path}`);
    this.createMapper([path]);
  }

  private initWatcher() {
    this.watcher = chokidar
      .watch(this.getWatchFolders(), { cwd: this.options.cwd ?? process.cwd(), ignoreInitial: true })
      .on('unlinkDir', this.onUnlink.bind(this))
      .on('unlink', this.onUnlink.bind(this))
      .on('add', this.onUpdate.bind(this))
      .on('change', this.onUnlink.bind(this));
  }

  onModuleInit() {
    this.initMapper();
    this.initWatcher();
  }

  async onModuleDestroy() {
    if (this.watcher) {
      return await this.watcher.close();
    }
  }

  /**
   * Generates a SQL statement using `mybatis-mapper`, based on a namespace
   * and SQL ID defined in the MyBatis XML mappings.
   *
   * @param namespace The `<mapper namespace="...">` value in MyBatis XML files.
   * @param sql       The `<select id="...">`, `<update id="...">`, etc. ID inside the XML.
   * @param param     Optional parameter object for the SQL statement.
   * @param format    Formatting configuration:
   *                  - `false` disables formatting
   *                  - an object overrides defaults via shallow merge
   *                  - `undefined` results in using only defaults (if any)
   *
   * @throws MybatisMapperError Wraps any underlying `mybatis-mapper` error
   *         to provide consistent error handling at this layer.
   */
  getStatement = (
    namespace: string,
    sql: string,
    param?: Params,
    format?: Format | { language: Format['language'] | {} } | false
  ) => {
    try {
      let finalFormat: Format | undefined;

      if (format !== false) {
        const merged = { ...this.options.format, ...(format as Format) };
        if (!isEmptyObject(merged)) {
          finalFormat = merged;
        }
      }

      return mybatisMapper.getStatement(namespace, sql, param, finalFormat);
    } catch (error) {
      throw new MybatisMapperError(error, error);
    }
  };
}
