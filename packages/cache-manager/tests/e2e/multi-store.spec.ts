import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'net';
import request from 'supertest';
import { CACHE_MANAGER } from '../../lib';
import { MultiStoreModule } from '../src/multi-store/multi-store.module';

describe('Caching Multi Store', () => {
  let server: Server;
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [MultiStoreModule],
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpServer();
    await app.init();
  });

  it(`should return empty`, async () => {
    return request(server).get('/').expect(200, '');
  });

  it(`should return data`, async () => {
    return request(server).get('/').expect(200, 'multi-store-value');
  });

  afterAll(async () => {
    await app.get(CACHE_MANAGER).clear();
    await app.close();
  });
});
