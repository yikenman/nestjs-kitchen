import { Server } from 'net';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import session from 'express-session';
import request from 'supertest';
import { CsrfModule } from '../../src';
import { AppController } from '../app.controller';
import { HEADER_KEY, SECRET } from '../contant';

describe('CSRF (session / express)', () => {
  let server: Server;
  let app: NestExpressApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CsrfModule.register({
          type: 'session',
          headerKey: HEADER_KEY
        })
      ],
      controllers: [AppController]
    }).compile();

    app = module.createNestApplication<NestExpressApplication>(new ExpressAdapter());
    app.use(
      session({
        secret: SECRET,
        resave: false,
        saveUninitialized: false
      })
    );
    app.useLogger(false);

    server = app.getHttpServer();
    await app.init();
  });

  it(`should create and sign CSRF token via session`, async () => {
    const res = await request(server).get('/csrf');
    expect(typeof res.headers[HEADER_KEY]).toBe('string');
    expect(res.headers['set-cookie']).toBeDefined();

    return request(server)
      .post('/require-csrf')
      .set('Cookie', res.headers['set-cookie'])
      .set(HEADER_KEY, res.headers[HEADER_KEY])
      .expect(201);
  });

  it(`should succeed if reuses the same CSRF token`, async () => {
    const res = await request(server).get('/csrf');

    await request(server)
      .post('/require-csrf')
      .set('Cookie', res.headers['set-cookie'])
      .set(HEADER_KEY, res.headers[HEADER_KEY])
      .expect(201);

    await request(server)
      .post('/require-csrf')
      .set('Cookie', res.headers['set-cookie'])
      .set(HEADER_KEY, res.headers[HEADER_KEY])
      .expect(201);

    return;
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
    const res = await request(server).get('/csrf');

    await request(server).get('/not-public').expect(500);

    return request(server)
      .get('/not-public')
      .set('Cookie', res.headers['set-cookie'])
      .set(HEADER_KEY, res.headers[HEADER_KEY])
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
