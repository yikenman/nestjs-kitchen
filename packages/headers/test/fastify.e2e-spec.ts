import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { HeadersModule } from '../src';
import { AppController } from './app.controller';

describe('Proxy (Fastify)', () => {
  let server: Server;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        HeadersModule.register({
          headers: { 'X-Test': '1' }
        })
      ],
      controllers: [AppController]
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false);

    server = app.getHttpServer();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it(`should set headers successfully.`, async () => {
    const res = await request(server).get('/test').expect(200);
    expect(res.headers['x-test']).toBe('1');
  });

  afterAll(async () => {
    await app.close();
  });
});
