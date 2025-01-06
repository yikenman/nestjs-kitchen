import type { FactoryProvider } from '@nestjs/common';
import { uid } from 'uid';
import { ConnextionInstance } from './connextion.instance';
import { defineConnextionBuilder } from './connextion.module';
import { createConnextionService } from './connextion.service';
import { DEFAULT_INSTANCE_NAME, INJECT_TOKEN_ID, PREFIX } from './constants';
import { createAsyncProviders, joinStrs, mixinModule, normalizeConnections } from './utils';

jest.mock('uid', () => {
  const actual = jest.requireActual('uid');
  return {
    uid: jest.fn(actual.uid)
  };
});

jest.mock('./connextion.service', () => {
  const actual = jest.requireActual('./connextion.service');
  return {
    ...actual,
    createConnextionService: jest.fn(actual.createConnextionService)
  };
});

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    normalizeConnections: jest.fn(actual.normalizeConnections),
    mixinModule: jest.fn(actual.mixinModule),
    joinStrs: jest.fn(actual.joinStrs),
    createAsyncProviders: jest.fn(actual.createAsyncProviders)
  };
});

class TestConnextionInstance extends ConnextionInstance<unknown> {
  dispose() {
    return 'disposed';
  }

  create(options: unknown) {
    return `created with ${options}`;
  }
}

// @ts-ignore
const MockConnextionInstance = jest.fn((...rest) => new TestConnextionInstance(...rest));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('defineConnextionBuilder', () => {
  it('should correctly return a factory function', () => {
    const builder = defineConnextionBuilder({
      connextionName: 'Test',
      InstanceClass: MockConnextionInstance
    });

    expect(builder).toBeDefined();
    expect(typeof builder).toBe('function');
  });

  describe('defineConnextion', () => {
    it('should return module & service based on provided name', () => {
      const builder = defineConnextionBuilder({
        connextionName: 'Test',
        InstanceClass: MockConnextionInstance
      });

      const { TestModule, Test } = builder();

      expect(createConnextionService).toHaveBeenCalledTimes(1);

      expect(mixinModule).toHaveBeenCalledTimes(1);
      expect(mixinModule).toHaveBeenCalledWith('TestModule', expect.any(Function));

      expect(TestModule).toBeDefined();
      expect(typeof TestModule).toBe('function');
      expect(Test).toBeDefined();
      expect(typeof Test).toBe('function');
    });

    describe('connextion module', () => {
      describe('register', () => {
        it('should return a dynamic module', () => {
          const builder = defineConnextionBuilder({
            connextionName: 'Test',
            InstanceClass: MockConnextionInstance
          });

          const { TestModule, Test } = builder();

          jest.mocked(uid).mockClear();

          const otherOptions = {
            imports: []
          };
          const options = { connections: [{ name: 'testConnection' }], ...otherOptions };
          const module = TestModule.register(options);

          expect(uid).toHaveBeenCalledTimes(1);

          expect(normalizeConnections).toHaveBeenCalledTimes(1);
          expect(normalizeConnections).toHaveBeenCalledWith(options.connections, DEFAULT_INSTANCE_NAME);

          expect(joinStrs).toHaveBeenCalledTimes(options.connections.length);

          const injectTokenId = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;

          options.connections.forEach(({ name }, i) => {
            expect(joinStrs).toHaveBeenNthCalledWith(i + 1, injectTokenId, name);
          });

          expect(module).toBeDefined();
          expect(module).toEqual(
            expect.objectContaining({
              ...otherOptions,
              module: TestModule,
              providers: expect.arrayContaining([
                ...options.connections.map(() => ({
                  provide: expect.any(String),
                  useFactory: expect.any(Function)
                })),
                {
                  provide: INJECT_TOKEN_ID,
                  useValue: injectTokenId
                },
                Test
              ]),
              exports: expect.arrayContaining([Test])
            })
          );
        });

        it('should create instance of InstanceClass in useFactroy', () => {
          const builder = defineConnextionBuilder({
            connextionName: 'Test',
            InstanceClass: MockConnextionInstance
          });

          const { TestModule } = builder();

          const options = { connections: [{ name: 'testConnection' }] };
          const module = TestModule.register(options);

          const result: InstanceType<typeof MockConnextionInstance> = (
            module.providers![0] as FactoryProvider
          ).useFactory();

          expect(result instanceof TestConnextionInstance).toBeTruthy();
          expect(MockConnextionInstance).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
        });

        it('should call normalizeConnections with custom defaultInstanceName if provided', () => {
          const builder = defineConnextionBuilder({
            connextionName: 'Test',
            InstanceClass: MockConnextionInstance,
            defaultInstanceName: 'customName'
          });

          const { TestModule } = builder();

          const options = { connections: [{ name: 'testConnection' }] };
          const module = TestModule.register(options);

          expect(normalizeConnections).toHaveBeenCalledTimes(1);
          expect(normalizeConnections).toHaveBeenCalledWith(options.connections, 'customName');

          expect(module).toBeDefined();
        });
      });

      describe('async register', () => {
        it('should correctly register async options using registerAsync method', () => {
          const builder = defineConnextionBuilder({
            connextionName: 'Test',
            InstanceClass: MockConnextionInstance
          });

          const { TestModule, Test } = builder();

          jest.mocked(uid).mockClear();

          const otherOptions = {
            imports: []
          };
          const options = { connections: [{ name: 'testConnection', useFactory: jest.fn() }], ...otherOptions };
          const module = TestModule.registerAsync(options);

          expect(uid).toHaveBeenCalledTimes(1);

          expect(normalizeConnections).toHaveBeenCalledTimes(1);
          expect(normalizeConnections).toHaveBeenCalledWith(options.connections, DEFAULT_INSTANCE_NAME);

          expect(joinStrs).toHaveBeenCalledTimes(options.connections.length * 2);

          const injectTokenId = `${PREFIX}${jest.mocked(uid).mock.results[0].value}`;

          options.connections.forEach(({ name, ...rest }, i) => {
            expect(joinStrs).toHaveBeenNthCalledWith(i * 2 + 1, injectTokenId, name);
            expect(joinStrs).toHaveBeenNthCalledWith(
              i * 2 + 2,
              jest.mocked(joinStrs).mock.results[i * 2].value,
              'options'
            );
            expect(createAsyncProviders).toHaveBeenNthCalledWith(i + 1, expect.any(Symbol), rest);
          });

          expect(module).toBeDefined();
          expect(module).toEqual(
            expect.objectContaining({
              ...otherOptions,
              module: TestModule,
              providers: expect.arrayContaining([
                ...options.connections.map(() => ({
                  provide: expect.any(String),
                  useFactory: expect.any(Function),
                  inject: [expect.any(Symbol)]
                })),
                ...jest.mocked(createAsyncProviders).mock.results.flatMap((ele) => ele.value),
                {
                  provide: INJECT_TOKEN_ID,
                  useValue: injectTokenId
                },
                Test
              ]),
              exports: expect.arrayContaining([Test])
            })
          );
        });

        it('should create instance of InstanceClass in useFactroy', () => {
          const builder = defineConnextionBuilder({
            connextionName: 'Test',
            InstanceClass: MockConnextionInstance
          });

          const { TestModule } = builder();

          const options = { connections: [{ name: 'testConnection', useFactory: jest.fn() }] };
          const module = TestModule.registerAsync(options);

          const connectionOptions = {};
          const result: InstanceType<typeof MockConnextionInstance> = (
            module.providers![1] as FactoryProvider
          ).useFactory(connectionOptions);

          expect(result instanceof TestConnextionInstance).toBeTruthy();
          expect(MockConnextionInstance).toHaveBeenCalledWith(expect.any(String), connectionOptions);
        });

        it('should call normalizeConnections with custom defaultInstanceName if provided', () => {
          const builder = defineConnextionBuilder({
            connextionName: 'Test',
            InstanceClass: MockConnextionInstance,
            defaultInstanceName: 'customName'
          });

          const { TestModule } = builder();

          const options = { connections: [{ name: 'testConnection', useFactory: jest.fn() }] };
          const module = TestModule.registerAsync(options);

          expect(normalizeConnections).toHaveBeenCalledTimes(1);
          expect(normalizeConnections).toHaveBeenCalledWith(options.connections, 'customName');

          expect(module).toBeDefined();
        });
      });
    });
  });
});
