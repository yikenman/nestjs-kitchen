import { Test } from '@nestjs/testing';
import chokidar from 'chokidar';
import mybatisMapper from 'mybatis-mapper';
import tinyglobby from 'tinyglobby';
import { MybatisMapperError } from './errors';
import { MODULE_OPTIONS_TOKEN } from './module-builder';
import { MybatisMapper } from './mybatis-mapper.service';
import type { MybatisMapperModuleOptions } from './types';

jest.mock('mybatis-mapper');
jest.mock('tinyglobby', () => ({
  globSync: jest.fn()
}));
jest.mock('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn()
  })
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('MybatisMapper', () => {
  let service: MybatisMapper;

  let mockOptions: MybatisMapperModuleOptions;

  beforeEach(async () => {
    mockOptions = {
      patterns: ['test/fixtures/**/*.xml'],
      watchPatterns: ['test/fixtures'],
      cwd: '/work/dir',
      format: {}
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MybatisMapper,
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: mockOptions
        }
      ]
    }).compile();

    service = moduleRef.get(MybatisMapper);
  });

  describe('getXmls', () => {
    it('getXmls should return only .xml files', () => {
      const globSyncMock = tinyglobby.globSync as jest.Mock;
      globSyncMock.mockReturnValue(['test/a.xml', 'test/b.txt']);

      const xmls = service['getXmls']();
      expect(xmls).toEqual(['test/a.xml']);
    });

    it('should print log and return empty array if no patterns were provided', () => {
      mockOptions.patterns = [];

      const loggerVerbose = jest.spyOn(service['logger'], 'verbose');
      const xmls = service['getXmls']();

      expect(loggerVerbose).toHaveBeenCalled();
      expect(xmls).toEqual([]);
    });
  });

  describe('getWatchFolders', () => {
    it('should return empty array if no watchPatterns were provided', () => {
      mockOptions.watchPatterns = [];

      const folders = service['getWatchFolders']();

      expect(folders).toEqual([]);
    });
  });

  describe('createMapper', () => {
    it('should print error if failed to create mapper', () => {
      const err = new Error('test error');

      const loggerError = jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

      const createMapperMock = mybatisMapper.createMapper as jest.Mock;
      createMapperMock.mockImplementationOnce(() => {
        throw err;
      });
      service['createMapper'](['test/fixtures/mapper.xml']);

      expect(loggerError).toHaveBeenCalled();
    });
  });

  describe('initMapper', () => {
    it('should clear mappers and load xmls on init', () => {
      const getMapperMock = mybatisMapper.getMapper as jest.Mock;
      const createMapperMock = mybatisMapper.createMapper as jest.Mock;
      const globSyncMock = tinyglobby.globSync as jest.Mock;

      getMapperMock.mockReturnValue({ a: 'a', b: 'b' });
      globSyncMock.mockReturnValue(['test/fixtures/a.xml', 'test/fixtures/b.txt']);

      service['initMapper']();

      expect(getMapperMock).toHaveBeenCalled();
      expect(createMapperMock).toHaveBeenCalledWith(['test/fixtures/a.xml']);
    });
  });

  describe('onUnlink', () => {
    it('should call initMapper', () => {
      //@ts-ignore
      const initMapper = jest.spyOn(service, 'initMapper');

      service['onUnlink']();

      expect(initMapper).toHaveBeenCalled();
    });
  });
  describe('onUpdate', () => {
    it('should call createMapper', () => {
      //@ts-ignore
      const createMapper = jest.spyOn(service, 'createMapper');

      service['onUpdate']('test/path');

      expect(createMapper).toHaveBeenCalled();
    });
  });

  describe('initWatcher', () => {
    it('should use process.cwd() as default cwd', () => {
      mockOptions.cwd = undefined;

      const fakeWatcher = { on: jest.fn().mockReturnThis() };
      (chokidar.watch as jest.Mock).mockReturnValue(fakeWatcher);

      service['initWatcher']();

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          cwd: process.cwd()
        })
      );
    });
  });

  describe('onModuleInit', () => {
    it('should watch folders and bind handlers onModuleInit', () => {
      const globSyncMock = tinyglobby.globSync as jest.Mock;
      globSyncMock.mockImplementation(({ onlyDirectories }: any) =>
        onlyDirectories ? ['test/fixtures'] : ['test/fixtures/a.xml']
      );

      service.onModuleInit();

      expect(chokidar.watch).toHaveBeenCalledWith(['test/fixtures'], expect.any(Object));
    });
  });

  describe('onModuleDestroy', () => {
    it('should close watcher onModuleDestroy', async () => {
      const close = jest.fn();
      const fakeWatcher = { on: jest.fn().mockReturnThis(), close };
      (chokidar.watch as jest.Mock).mockReturnValue(fakeWatcher);

      service['initWatcher']();
      await service.onModuleDestroy();

      expect(close).toHaveBeenCalled();
    });
  });

  describe('getStatement', () => {
    it('getStatement should wrap mybatis getStatement', () => {
      const getStatementMock = mybatisMapper.getStatement as jest.Mock;
      getStatementMock.mockReturnValue('SQL');

      const result = service.getStatement('ns', 'id', { a: 1 });
      expect(result).toBe('SQL');
      expect(getStatementMock).toHaveBeenCalledWith('ns', 'id', { a: 1 }, mockOptions.format);
    });

    it('should throw MybatisMapperError when failed', () => {
      const err = new Error('test error');

      const getStatementMock = mybatisMapper.getStatement as jest.Mock;
      getStatementMock.mockImplementationOnce(() => {
        throw err;
      });

      expect(() => service.getStatement('ns', 'id', { a: 1 })).toThrow(MybatisMapperError);
    });
  });
});
