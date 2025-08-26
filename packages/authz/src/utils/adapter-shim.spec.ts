import { ExecutionContext } from '@nestjs/common';
import { AdapterShim, createOnceAdapterShimProvider } from './adapter-shim';

describe('AdapterShim', () => {
  describe('Express', () => {
    let shim: AdapterShim;
    let req: any;
    let res: any;
    let ctx: ExecutionContext;

    beforeEach(() => {
      req = {
        session: {
          foo: 'bar',
          regenerate: jest.fn(),
          save: jest.fn()
        }
      };
      res = { cookie: jest.fn() };
      ctx = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res
        })
      } as unknown as ExecutionContext;

      shim = new AdapterShim({ httpAdapter: { constructor: { name: 'ExpressAdapter' } } } as any);
      shim.onModuleInit();
      shim.canActivate(ctx);
    });

    it('getSession should return value', () => {
      expect(req.shims.getSession('foo')).toBe('bar');
    });

    it('getSession should return undefined when no session', () => {
      req.session = undefined;
      expect(req.shims.getSession('foo')).toBeUndefined();
    });

    it('setSession should set value', () => {
      req.shims.setSession('baz', 123);
      expect(req.session.baz).toBe(123);
    });

    it('setSession should throw error when no session', () => {
      req.session = undefined;
      expect(() => req.shims.setSession('baz', 123)).toThrow(Error);
    });

    it('deleteSession should remove key', () => {
      req.shims.deleteSession('foo');
      expect(req.session.foo).toBeUndefined();
    });

    it('deleteSession should noop when no session', () => {
      req.session = undefined;
      expect(() => req.shims.deleteSession('foo')).not.toThrow();
    });

    it('getAllSession should return clone', () => {
      expect(req.shims.getAllSession()).toEqual({ foo: 'bar' });
      expect(req.shims.getAllSession()).not.toBe(req.session);
    });

    it('getAllSession should return {} when no session', () => {
      req.session = undefined;
      expect(req.shims.getAllSession()).toEqual({});
    });

    it('sessionContains should return true if exists', () => {
      expect(req.shims.sessionContains('foo')).toBe(true);
    });

    it('sessionContains should return false if not exists', () => {
      expect(req.shims.sessionContains('baz')).toBe(false);
    });

    it('sessionContains should return false when no session', () => {
      req.session = undefined;
      expect(req.shims.sessionContains('foo')).toBe(false);
    });

    it('regenerateSession should resolve on success', async () => {
      req.session.regenerate.mockImplementation((cb: Function) => cb(null));
      await expect(req.shims.regenerateSession()).resolves.toBeUndefined();
    });

    it('regenerateSession should reject on error', async () => {
      req.session.regenerate.mockImplementation((cb: Function) => cb(new Error('fail')));
      await expect(req.shims.regenerateSession()).rejects.toThrow('fail');
    });

    it('saveSession should resolve on success', async () => {
      req.session.save.mockImplementation((cb: Function) => cb(null));
      await expect(req.shims.saveSession()).resolves.toBeUndefined();
    });

    it('saveSession should reject on error', async () => {
      req.session.save.mockImplementation((cb: Function) => cb(new Error('savefail')));
      await expect(req.shims.saveSession()).rejects.toThrow('savefail');
    });

    it('setCookie should call res.cookie', () => {
      res.shims.setCookie('key', 'value', { path: '/' });
      expect(res.cookie).toHaveBeenCalledWith('key', 'value', { path: '/' });
    });
  });

  describe('Fastify', () => {
    let shim: AdapterShim;
    let req: any;
    let res: any;
    let ctx: ExecutionContext;

    beforeEach(() => {
      req = {
        session: {
          data: { foo: 'bar' },
          set: jest.fn((k, v) => (req.session.data[k] = v)),
          get: jest.fn((k) => req.session.data[k]),
          delete: jest.fn((k) => delete req.session.data[k]),
          save: jest.fn((cb: Function) => cb(null)),
          regenerate: jest.fn((cb: Function) => cb(null))
        },
        raw: {}
      };
      res = { setCookie: jest.fn(), raw: {} };
      ctx = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res
        })
      } as unknown as ExecutionContext;

      shim = new AdapterShim({ httpAdapter: { constructor: { name: 'FastifyAdapter' } } } as any);
      shim.onModuleInit();
      shim.canActivate(ctx);
    });

    it('getSession should return value', () => {
      expect(req.raw.shims.getSession('foo')).toBe('bar');
    });

    it('getSession should return undefined if not exist', () => {
      expect(req.raw.shims.getSession('baz')).toBeUndefined();
    });

    it('setSession should set value', () => {
      req.raw.shims.setSession('baz', 123);
      expect(req.session.data.baz).toBe(123);
    });

    it('deleteSession should remove key', () => {
      req.raw.shims.deleteSession('data');
      expect(req.session.data).toBeUndefined();
    });

    describe('getAllSession', () => {
      it('should return clone', () => {
        expect(req.raw.shims.getAllSession()).toEqual({ data: { foo: 'bar' } });
      });

      it('should exclude cookie when cookie prototype name is Cookie', () => {
        req.session = { foo: 'bar', cookie: {} };
        req.session.cookie.constructor = { name: 'Cookie' };
        expect(req.raw.shims.getAllSession()).toEqual({ foo: 'bar' });
      });

      it('should exclude changed and deleted when prototype name is Session', () => {
        req.session = { foo: 'bar', changed: true, deleted: true };
        req.session.constructor = { name: 'Session' };
        expect(req.raw.shims.getAllSession()).toEqual(expect.objectContaining({ foo: 'bar' }));
      });
    });

    describe('sessionContains', () => {
      it('should return false if no session', () => {
        req.session = null;
        expect(req.raw.shims.sessionContains('foo')).toBe(false);
      });

      it('should return true when key exists in @fastify/session', () => {
        req.session = { foo: 'bar' };
        expect(req.raw.shims.sessionContains('foo')).toBe(true);
      });

      it('should check @fastify/secure-session get()', () => {
        req.session = { get: jest.fn().mockReturnValue('bar') };
        expect(req.raw.shims.sessionContains('foo')).toBe(true);
      });

      it('should return false if  @fastify/secure-session get() returns undefined', () => {
        req.session = { get: jest.fn().mockReturnValue(undefined) };
        expect(req.raw.shims.sessionContains('foo')).toBe(false);
      });
    });

    describe('regenerateSession', () => {
      it('should call regenerate for @fastify/session', async () => {
        const regenerate = jest.fn().mockResolvedValue(undefined);
        req.session = { save: jest.fn(), regenerate };
        await req.raw.shims.regenerateSession();
        expect(regenerate).toHaveBeenCalled();
      });

      it('should call regenerate for @fastify/secure-session (no save)', async () => {
        const regenerate = jest.fn();
        req.session = { regenerate };
        await req.raw.shims.regenerateSession();
        expect(regenerate).toHaveBeenCalled();
      });

      it('should reject if regenerate throws in @fastify/secure-session', async () => {
        req.session = {
          regenerate: jest.fn(() => {
            throw new Error('fail');
          })
        };
        await expect(req.raw.shims.regenerateSession()).rejects.toThrow('fail');
      });
    });

    describe('saveSession', () => {
      it('should call save for fastify-session', async () => {
        const save = jest.fn().mockResolvedValue(undefined);
        req.session = { save };
        await req.raw.shims.saveSession();
        expect(save).toHaveBeenCalled();
      });

      it('should resolve immediately for fastify-secure-session', async () => {
        req.session = {};
        await expect(req.raw.shims.saveSession()).resolves.toBeUndefined();
      });
    });

    it('setCookie should call res.setCookie', () => {
      res.raw.shims.setCookie('key', 'value', { path: '/' });
      expect(res.setCookie).toHaveBeenCalledWith('key', 'value', { path: '/' });
    });
  });

  it('should throw error if no adapter matched', () => {
    const adapter = 'OtherAdapter';
    const shim = new AdapterShim({ httpAdapter: { constructor: { name: adapter } } } as any);

    expect(() => {
      shim.onModuleInit();
    }).toThrow(`Cannot find shims factory for adapter "${adapter}".`);
  });

  describe('createOnceAdapterShimProvider', () => {
    it('should register only once', () => {
      const providers1 = createOnceAdapterShimProvider();
      expect(providers1).toHaveLength(1);

      const providers2 = createOnceAdapterShimProvider();
      expect(providers2).toHaveLength(0);
    });
  });
});
