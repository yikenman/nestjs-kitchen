import { Client, type PrestoRequestError, type QueryOptions } from 'presto-client';
import { PrestoError } from './errors';
import { PrestoInstance } from './presto.instance';
import { createDebugLogger, noop } from './utils';

jest.mock('presto-client', () => {
  const actual = jest.requireActual('presto-client');

  return {
    ...actual,
    Client: jest.fn(actual.Client)
  };
});

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');

  return {
    ...actual,
    createDebugLogger: jest.fn(actual.createDebugLogger),
    noop: jest.fn(actual.noop)
  };
});

describe('PrestoInstance', () => {
  let prestoInstance: PrestoInstance;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockClient = {
      execute: jest.fn(),
      kill: jest.fn()
    } as any;

    prestoInstance = new PrestoInstance('testInstance');
    // @ts-ignore
    prestoInstance.create({ user: 'testUser', basic_auth: { user: 'testUser' } });
    prestoInstance['client'] = mockClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('debug mode', () => {
    it('should not create debug logger by default', () => {
      expect(createDebugLogger).not.toHaveBeenCalled();
      expect(prestoInstance['debugLogger']).toBe(noop);
    });

    it('should create debug logger if debug option is defined', () => {
      const instance = new PrestoInstance('testInstance', {
        debug: true
      });

      expect(createDebugLogger).toHaveBeenCalled();
      expect(instance['debugLogger']).toBe(jest.mocked(createDebugLogger).mock.results[0].value);
    });
  });

  describe('dispose', () => {
    it('should dispose the client and queryIdMap correctly', async () => {
      // @ts-ignore
      const mockEnd = jest.spyOn(prestoInstance, 'end').mockResolvedValue(undefined);

      await prestoInstance.dispose();

      expect(prestoInstance['client']).toBeUndefined();
      expect(prestoInstance['queryIdMap']).toEqual(new Map());
      expect(mockEnd).toHaveBeenCalledWith(mockClient, expect.any(Map));
    });
  });

  describe('execute', () => {
    it('should throw PrestoError if client is not found', async () => {
      prestoInstance['client'] = undefined;

      await expect(prestoInstance.execute({ query: 'SELECT * FROM test' })).rejects.toThrow(
        new PrestoError('client not found.')
      );
    });

    it('should execute the query and return correct result', async () => {
      const options = { query: 'SELECT * FROM test' };
      const id = `${Math.random()}`;

      prestoInstance['client']!.execute = jest.fn((opts: any) => {
        opts.state(null, id, { state: 'RUNNING' });
        opts.columns(null, [{ name: 'column1' }]);
        opts.data(null, [['value1']]);

        opts.success();
      });

      const result = await prestoInstance.execute(options);

      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('queryId');
      expect(prestoInstance['queryIdMap'].has(id)).toBeTruthy();
      expect(prestoInstance['debugLogger']).toHaveBeenCalled();
    });

    it('should remove query id if query finished', async () => {
      const options = { query: 'SELECT * FROM test' };
      const id = `${Math.random()}`;

      prestoInstance['client']!.execute = jest.fn((opts: any) => {
        opts.state(null, id, { state: 'RUNNING' });
        opts.state(null, id, { state: 'FINISHED' });
        opts.columns(null, [{ name: 'column1' }]);
        opts.data(null, [['value1']]);

        opts.success();
      });

      const result = await prestoInstance.execute(options);

      expect(result).toHaveProperty('columns');
      expect(result).toHaveProperty('rows');
      expect(result).toHaveProperty('queryId');
      expect(prestoInstance['queryIdMap'].has(id)).toBeFalsy();
      expect(prestoInstance['debugLogger']).toHaveBeenCalled();
    });

    it('should handle error during query execution and call reject', async () => {
      const options = { query: 'SELECT * FROM test' };
      const err = new Error('Query failed');

      prestoInstance['client']!.execute = jest.fn((opts: any) => {
        opts.error(err);
      });

      await expect(prestoInstance.execute(options)).rejects.toThrow(new PrestoError(err.message, err));
      expect(noop).toHaveBeenCalled();
    });
  });

  describe('end', () => {
    it('should end queries with queryIdMap', async () => {
      prestoInstance['queryIdMap'] = new Map([['queryId1', 'RUNNING']]);
      const mockKill = jest.fn((id: string, cb: (err: PrestoRequestError | null) => any) => cb(null));
      prestoInstance['client']!.kill = mockKill;

      await prestoInstance['end'](mockClient, prestoInstance['queryIdMap']);

      expect(mockKill).toHaveBeenCalledWith('queryId1', expect.any(Function));
      expect(prestoInstance['debugLogger']).toHaveBeenCalled();
    });

    it('should handle error when ending queries', async () => {
      prestoInstance['queryIdMap'] = new Map([['queryId1', 'RUNNING']]);
      const err = new Error('error');
      const mockKill = jest.fn((id: string, cb: (err: PrestoRequestError | null) => any) => cb(err));
      prestoInstance['client']!.kill = mockKill;

      await prestoInstance['end'](mockClient, prestoInstance['queryIdMap']);

      expect(mockKill).toHaveBeenCalledWith('queryId1', expect.any(Function));
      expect(prestoInstance['debugLogger']).toHaveBeenCalled();
    });

    it('should not end queries if queryIdMap has completed queries', async () => {
      prestoInstance['queryIdMap'] = new Map([['queryId1', 'FINISHED']]);

      const result = await prestoInstance['end'](mockClient, prestoInstance['queryIdMap']);

      expect(result).toBeUndefined(); // No queries should be killed.
    });
  });

  describe('create', () => {
    it('should create a new client and initialize it', () => {
      const options = { user: 'newUser' };

      prestoInstance.create(options);

      expect(prestoInstance['client']).toBeDefined();
      expect(Client).toHaveBeenCalledWith(options);
    });

    it('should take basic_auth.user as user if user is not defined', () => {
      const options = { basic_auth: { user: 'newUser' } };
      // @ts-ignore
      prestoInstance.create(options);

      expect(prestoInstance['client']).toBeDefined();
      expect(Client).toHaveBeenCalledWith({ ...options, ...options.basic_auth });
    });
  });
});
