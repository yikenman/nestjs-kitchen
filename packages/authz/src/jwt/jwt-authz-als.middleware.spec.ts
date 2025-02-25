import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { createSetCookieFn } from '../utils';
import { JwtAlsType, createJwtAuthzAlsMiddleware } from './jwt-authz-als.middleware';
import type { JwtAuthzOptions } from './jwt-authz.interface';

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
  const JWT_AUTHZ_OPTIONS = 'JWT_AUTHZ_OPTIONS';

  let middleware: InstanceType<ReturnType<typeof createJwtAuthzAlsMiddleware>>;
  let als: AsyncLocalStorage<JwtAlsType<unknown>>;
  let jwtAuthzOptions: JwtAuthzOptions;

  beforeEach(async () => {
    als = new AsyncLocalStorage();
    jwtAuthzOptions = {
      jwt: {
        secretOrPublicKey: '123456'
      }
    } as JwtAuthzOptions;
    const JwtAuthzAlsMiddleware = createJwtAuthzAlsMiddleware([ALS_PROVIDER, JWT_AUTHZ_OPTIONS]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthzAlsMiddleware,
        { provide: ALS_PROVIDER, useValue: als },
        { provide: JWT_AUTHZ_OPTIONS, useValue: jwtAuthzOptions }
      ]
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
    const req = {} as Request;
    const res = {} as Response;
    const next: NextFunction = () => {
      const store = als.getStore();
      expect(store).toEqual({
        user: undefined,
        jwtVerifiedBy: undefined,
        allowAnonymous: undefined,
        authOptions: jwtAuthzOptions,
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
    const req = {} as Request;
    const res = {} as Response;
    const next: NextFunction = jest.fn(() => done());

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
