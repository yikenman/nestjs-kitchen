import secureSession from '@fastify/secure-session';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Server } from 'net';
import request from 'supertest';
import { CsrfModule } from '../../src';
import { AppController } from '../app.controller';
import { HEADER_KEY, SALT, SECRET } from '../contant';

describe('CSRF (secure-session / one-time-token / fastify)', () => {
  let server: Server;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CsrfModule.register({
          type: 'session',
          oneTimeToken: true,
          oneTimeTokenTTL: 1000,
          headerKey: HEADER_KEY
        })
      ],
      controllers: [AppController]
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(secureSession, {
      secret: SECRET,
      salt: SALT,
      cookie: {
        secure: false
      }
    });
    app.useLogger(false);

    server = app.getHttpServer();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it(`should not support one-time-token in secure-session`, async () => {
    const res = await request(server).get('/csrf').expect(500);
    expect(res.headers[HEADER_KEY]).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it(`should throw error if fail in CSRF verification`, async () => {
    return request(server).post('/require-csrf').expect(500);
  });

  it(`should skip CSRF verification if method is not in options.verifyMethods`, async () => {
    return request(server).get('/public').expect(200);
  });

  it(`should disable CSRF verification with @Csrf.NoVerify()`, async () => {
    return request(server).post('/not-require-csrf').expect(201);
  });

  it(`should enable CSRF verification with @Csrf()`, async () => {
    await request(server).get('/not-public').expect(500);
  });

  afterAll(async () => {
    await app.close();
  });
});
