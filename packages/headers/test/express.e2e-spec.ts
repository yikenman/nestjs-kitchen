import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { HeadersModule } from '../src';
import { AppController } from './app.controller';

describe('Headers (Express)', () => {
  let server: Server;
  let app: NestExpressApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        HeadersModule.register({
          headers: { 'X-Test': '1' }
        })
      ],
      controllers: [AppController]
    }).compile();

    app = module.createNestApplication<NestExpressApplication>(new ExpressAdapter());

    server = app.getHttpServer();
    await app.init();
  });

  it(`should set headers successfully.`, async () => {
    const res = await request(server).get('/test').expect(200);
    expect(res.headers['x-test']).toBe('1');
  });

  afterAll(async () => {
    await app.close();
  });
});
