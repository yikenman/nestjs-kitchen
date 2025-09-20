import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createSetCookieFn } from '../utils';
import { createJwtAuthzAlsMiddleware, JwtAlsType } from './jwt-authz-als.middleware';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    mixin: jest.fn(actual.mixin)
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');

  return {
    ...actual,
    createSetCookieFn: jest.fn(actual.createSetCookieFn)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Jwt Authz ALS Middleware', () => {
  const ALS_PROVIDER = 'ALS_PROVIDER';

  let middleware: InstanceType<ReturnType<typeof createJwtAuthzAlsMiddleware>>;
  let als: AsyncLocalStorage<JwtAlsType<unknown>>;

  beforeEach(async () => {
    als = new AsyncLocalStorage();
    const JwtAuthzAlsMiddleware = createJwtAuthzAlsMiddleware([ALS_PROVIDER]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthzAlsMiddleware, { provide: ALS_PROVIDER, useValue: als }]
    }).compile();

    middleware = module.get<InstanceType<typeof JwtAuthzAlsMiddleware>>(JwtAuthzAlsMiddleware);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should set up ALS context with default values', (done) => {
    const req: any = {};
    const res: any = {};
    const next = () => {
      const store = als.getStore();
      expect(store).toEqual({
        user: undefined,
        jwtVerifiedBy: undefined,
        allowAnonymous: undefined,
        guardResult: undefined,
        setCookie: expect.any(Function)
      });
      expect(createSetCookieFn).toHaveBeenCalledTimes(1);
      expect(createSetCookieFn).toHaveBeenCalledWith(req, res);
      done();
    };

    middleware.use(req, res, next);
  });

  it('should call next function', (done) => {
    const req: any = {};
    const res: any = {};
    const next = jest.fn(() => done());

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
