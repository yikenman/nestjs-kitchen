import { Test } from '@nestjs/testing';
import { MODULE_OPTIONS_TOKEN } from './module-builder';
import { MybatisMapperModule } from './mybatis-mapper.module';
import { MybatisMapper } from './mybatis-mapper.service';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('MybatisMapperModule', () => {
  it('should register module with register()', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MybatisMapperModule.register({
          cwd: '/project',
          patterns: ['**/*.xml']
        })
      ]
    }).compile();

    const mapper = moduleRef.get(MybatisMapper);
    expect(mapper).toBeInstanceOf(MybatisMapper);

    const options = moduleRef.get(MODULE_OPTIONS_TOKEN);
    expect(options).toEqual({
      cwd: '/project',
      patterns: ['**/*.xml']
    });
  });

  it('should register module with registerAsync()', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MybatisMapperModule.registerAsync({
          useFactory: async () => ({
            cwd: '/async/project',
            patterns: ['**/*.xml']
          })
        })
      ]
    }).compile();

    const mapper = moduleRef.get(MybatisMapper);
    expect(mapper).toBeInstanceOf(MybatisMapper);

    const options = moduleRef.get(MODULE_OPTIONS_TOKEN);
    expect(options).toEqual({
      cwd: '/async/project',
      patterns: ['**/*.xml']
    });
  });

  it('should register as global when global: true is passed (optional)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MybatisMapperModule.register({
          cwd: '/global/project',
          patterns: ['**/*.xml'],
          global: true
        })
      ]
    }).compile();

    const mapper = moduleRef.get(MybatisMapper);
    expect(mapper).toBeDefined();
  });
});
