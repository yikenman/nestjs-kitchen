import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import { Agent } from 'https';
import request from 'supertest';
import { ProxyModule } from '../src';
import { AppController } from './app.controller';

describe('Proxy (Express)', () => {
  let server: Server;
  let app: NestExpressApplication;

  beforeAll(async () => {
    const agent = new Agent({ keepAlive: true });

    const module = await Test.createTestingModule({
      imports: [
        ProxyModule.register({
          options: {
            target: 'https://jsonplaceholder.typicode.com',
            changeOrigin: true,
            headers: { 'x-module': 'yes' },
            agent
          }
        })
      ],
      controllers: [AppController]
    }).compile();

    app = module.createNestApplication<NestExpressApplication>(new ExpressAdapter(), { rawBody: true });

    server = app.getHttpServer();
    await app.init();
  });

  it(`should successfully proxy the request.`, async () => {
    const res = await request(server).get('/proxy-api/posts/1').expect(200);

    expect(res.body).toEqual(expect.any(Object));
    expect(res.body).not.toEqual({});
  });

  it(`should handle proxy error.`, async () => {
    const res = await request(server).get('/proxy-api/posts/-1').expect(404);

    expect(res.body).toEqual({});
  });

  it('should not proxy the request and should return directly.', async () => {
    const res = await request(server).get('/non-proxy-api/post/1').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  afterAll(async () => {
    await app.close();
  });
});
