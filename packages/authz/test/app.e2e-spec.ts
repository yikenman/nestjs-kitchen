import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { uid } from 'uid';
import { normalCookieParser } from '../src/utils';
import { AppModule } from './app/app.module';

describe('E2E test', () => {
  let app: INestApplication;
  const secret = '5678901234';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(session({ name: `session-id-${secret}`, secret: secret, resave: false, saveUninitialized: false }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let userId: string;

  beforeEach(() => {
    userId = uid();
  });

  describe('Only apply jwt authz', () => {
    const bases = [
      ['On a class', '/apply-jwt/apply-on-class'],
      ['On a method', '/apply-jwt/apply-on-method'],
      ['On both a class and its method', '/apply-jwt/apply-on-both']
    ];

    bases.forEach(([desc, base]) => {
      describe(desc, () => {
        it('should fail to retrieve user data without JWT', async () => {
          const res = await request(app.getHttpServer()).get(`${base}/get-user`);

          expect(res.statusCode).not.toEqual(200);
          expect(res.body).not.toEqual({
            userId1: userId
          });
        });

        it('should log in successfully and retrieve user data (GET)', async () => {
          const res = await request(app.getHttpServer())
            .get(`${base}/log-in?userId=${userId}`)
            .then((res) => {
              return request(app.getHttpServer())
                .get(`${base}/get-user`)
                .set('Authorization', `Bearer ${res.body.token}`);
            });

          expect(res.body).toEqual({
            userId1: userId
          });
        });
      });
    });
  });

  describe('Only apply session authz', () => {
    const bases = [
      ['On a class', '/apply-session/apply-on-class'],
      ['On a method', '/apply-session/apply-on-method'],
      ['On both a class and its method', '/apply-session/apply-on-both']
    ];

    bases.forEach(([desc, base]) => {
      describe(desc, () => {
        it('should fail to retrieve user data without session', async () => {
          const res = await request(app.getHttpServer()).get(`${base}/get-user`);

          expect(res.statusCode).not.toEqual(200);
          expect(res.body).not.toEqual({
            userId1: userId
          });
        });

        it('should log in successfully and retrieve user data (GET)', async () => {
          const res = await request(app.getHttpServer())
            .get(`${base}/log-in?userId=${userId}`)
            .then((res) => {
              return request(app.getHttpServer()).get(`${base}/get-user`).set('Cookie', res.headers['set-cookie'][0]);
            });

          expect(res.body).toEqual({
            userId3: userId
          });
        });
      });
    });
  });

  describe('Apply duplicated jwt authz', () => {
    const base = '/duplicated-jwt/apply-on-both';

    it('should only use the last authz module options', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);

      expect(() => {
        jwt.verify(res.body.token, '3456789012', { algorithms: ['HS384'] });
      }).toThrow();

      expect(() => {
        jwt.verify(res.body.token, '4567890123', { algorithms: ['HS512'] });
      }).not.toThrow();
    });

    it('should log in successfully and retrieve user data (GET)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${base}/log-in?userId=${userId}`)
        .then((res) => {
          return request(app.getHttpServer()).get(`${base}/get-user`).set('Authorization', `Bearer ${res.body.token}`);
        });

      expect(res.body).toEqual({
        userId1: userId
      });
    });
  });

  describe('Apply duplicated session authz', () => {
    const base = '/duplicated-session/apply-on-both';

    it('should only use the first authz module options', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);

      expect(
        normalCookieParser({
          headers: {
            cookie: res.headers['set-cookie'][0]
          },
          secret: secret
        } as unknown as Request).signedCookies
      ).toHaveProperty(`session-id-${secret}`);
    });

    it('should log in successfully and retrieve user data (GET)', async () => {
      const res = await request(app.getHttpServer())
        .get(`${base}/log-in?userId=${userId}`)
        .then((res) => {
          return request(app.getHttpServer()).get(`${base}/get-user`).set('Cookie', res.headers['set-cookie']);
        });

      expect(res.body).toEqual({
        userId3: userId
      });
    });
  });

  describe('Mix scenario', () => {
    describe('Apply one jwt authz on top of another jwt authz', () => {
      const base = '/mix/jwt-2-under-jwt-1';

      it('should create 2 different tokens with 2 authz options', async () => {
        const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);

        expect(res.body.result1.token).not.toEqual(res.body.result2.token);

        expect(() => {
          jwt.verify(res.body.result1.token, '7890123456', { algorithms: ['HS256'] });
        }).not.toThrow();

        expect(() => {
          jwt.verify(res.body.result2.token, '8901234567', { algorithms: ['HS256'] });
        }).not.toThrow();
      });

      it('should log in successfully and retrieve user data (GET)', async () => {
        const res = await request(app.getHttpServer())
          .get(`${base}/log-in?userId=${userId}`)
          .then((res) => {
            return request(app.getHttpServer())
              .get(`${base}/get-user?token=${res.body.result2.token}`)
              .set('Authorization', `Bearer ${res.body.result1.token}`);
          });

        expect(res.body).toEqual({
          user1: {
            userId1: userId
          },
          user2: {
            userId2: userId
          }
        });
      });
    });

    describe('Apply one jwt authz on top of another session authz', () => {
      const base = '/mix/session-under-jwt';

      it('should create jwt with jwt authz options, session token with session authz options', async () => {
        const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);

        expect(() => {
          jwt.verify(res.body.result1.token, '7890123456', { algorithms: ['HS256'] });
        }).not.toThrow();

        expect(
          normalCookieParser({
            headers: {
              cookie: res.headers['set-cookie'][0]
            },
            secret: secret
          } as unknown as Request).signedCookies
        ).toHaveProperty(`session-id-${secret}`);
      });

      it('should log in successfully and retrieve user data (GET)', async () => {
        const res = await request(app.getHttpServer())
          .get(`${base}/log-in?userId=${userId}`)
          .then((res) => {
            return request(app.getHttpServer())
              .get(`${base}/get-user`)
              .set('Authorization', `Bearer ${res.body.result1.token}`)
              .set('Cookie', res.headers['set-cookie']);
          });

        expect(res.body).toEqual({
          user1: {
            userId1: userId
          },
          user3: {
            userId3: userId
          }
        });
      });
    });

    describe('Apply one session authz on top of another session authz', () => {
      const base = '/mix/session-4-under-session-3';

      it('should get session token with the express-session options', async () => {
        const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);

        expect(
          normalCookieParser({
            headers: {
              cookie: res.headers['set-cookie'][0]
            },
            secret: secret
          } as unknown as Request).signedCookies
        ).toHaveProperty(`session-id-${secret}`);
      });

      it('should log in successfully and retrieve user data from the last ALS store (GET)', async () => {
        const res = await request(app.getHttpServer())
          .get(`${base}/log-in?userId=${userId}`)
          .then((res) => {
            return request(app.getHttpServer()).get(`${base}/get-user`).set('Cookie', res.headers['set-cookie']);
          });

        expect(res.body).toEqual({
          user3: {},
          user4: {
            userId4: userId
          }
        });
      });
    });

    describe('Apply one session authz on top of another jwt authz', () => {
      const base = '/mix/jwt-under-session';

      it('should create jwt with jwt authz options, session token with session authz options', async () => {
        const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);

        expect(() => {
          jwt.verify(res.body.result1.token, '7890123456', { algorithms: ['HS256'] });
        }).not.toThrow();

        expect(
          normalCookieParser({
            headers: {
              cookie: res.headers['set-cookie'][0]
            },
            secret: secret
          } as unknown as Request).signedCookies
        ).toHaveProperty(`session-id-${secret}`);
      });

      it('should log in successfully and retrieve user data (GET)', async () => {
        const res = await request(app.getHttpServer())
          .get(`${base}/log-in?userId=${userId}`)
          .then((res) => {
            return request(app.getHttpServer())
              .get(`${base}/get-user`)
              .set('Authorization', `Bearer ${res.body.result1.token}`)
              .set('Cookie', res.headers['set-cookie']);
          });

        expect(res.body).toEqual({
          user1: {
            userId1: userId
          },
          user3: {
            userId3: userId
          }
        });
      });
    });

    describe('Refresh jwt scenario', () => {
      const base = '/mix/jwt-refresh';

      it('should create jwt with jwt options, refresh token with refresh options', async () => {
        const res = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);
        expect(res.body.token).not.toEqual(res.body.refresh);

        expect(() => {
          jwt.verify(res.body.token, '7890123456', { algorithms: ['HS256'] });
        }).not.toThrow();

        expect(() => {
          jwt.verify(res.body.refresh, '65433210987', { algorithms: ['HS512'] });
        }).not.toThrow();
      });

      it('should refresh token successfully and retrieve user data (GET)', async () => {
        const {
          body: { token, refresh }
        } = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);
        const res1 = await request(app.getHttpServer()).get(`${base}/get-user`).set('Authorization', `Bearer ${token}`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const {
          body: { token: newToken }
        } = await request(app.getHttpServer()).get(`${base}/refresh`).set('Authorization', `Bearer ${refresh}`);

        const res2 = await request(app.getHttpServer())
          .get(`${base}/get-user`)
          .set('Authorization', `Bearer ${newToken}`);

        expect(res1.body).toEqual({ userId1: userId });
        expect(token).not.toEqual(newToken);
        expect(res1.body).toEqual(res2.body);
      });
    });

    describe('Refresh jwt with session scenario', () => {
      const base = '/mix/jwt-session-refresh';

      it('should refresh token successfully and retrieve user data (GET)', async () => {
        const {
          body: {
            result2: { token }
          },
          headers: { 'set-cookie': cookie }
        } = await request(app.getHttpServer()).get(`${base}/log-in?userId=${userId}`);
        const res1 = await request(app.getHttpServer()).get(`${base}/get-user`).set('Authorization', `Bearer ${token}`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const {
          body: {
            result2: { token: newToken }
          }
        } = await request(app.getHttpServer()).get(`${base}/refresh`).set('Cookie', cookie);
        const res2 = await request(app.getHttpServer())
          .get(`${base}/get-user`)
          .set('Authorization', `Bearer ${newToken}`);

        expect(res1.body).toEqual({ user2: { userId2: userId } });
        expect(token).not.toEqual(newToken);
        expect(res1.body).toEqual(res2.body);
      });
    });

    describe('Authorization scenario', () => {
      const base = '/mix/jwt-session-authz';

      it('should not pass jwt authorization with wrong permission', async () => {
        const res = await request(app.getHttpServer())
          .get(`${base}/log-in?userId=${userId}&jwtRole=ROLE_ID_2&sessionRole=ROLE_ID_2`)
          .then((res) => {
            return request(app.getHttpServer())
              .get(`${base}/get-user`)
              .set('Authorization', `Bearer ${res.body.result2.token}`)
              .set('Cookie', res.headers['set-cookie']);
          });

        expect(res.body.statusCode).toBe(403);
      });

      it('should not pass session authorization with wrong permission', async () => {
        const {
          body: {
            result2: { token }
          },
          headers: { 'set-cookie': cookie }
        } = await request(app.getHttpServer()).get(
          `${base}/log-in?userId=${userId}&jwtRole=ROLE_ID&sessionRole=ROLE_ID_2`
        );
        const res1 = await request(app.getHttpServer()).get(`${base}/get-user`).set('Authorization', `Bearer ${token}`);

        const res2 = await request(app.getHttpServer()).get(`${base}/refresh`).set('Cookie', cookie);

        expect(res1.body).toEqual({ user2: { jwtRole2: 'ROLE_ID', userId2: userId } });
        expect(res2.body.statusCode).toBe(403);
      });

      it('should refresh token successfully and retrieve user data (GET)', async () => {
        const {
          body: {
            result2: { token }
          },
          headers: { 'set-cookie': cookie }
        } = await request(app.getHttpServer()).get(
          `${base}/log-in?userId=${userId}&jwtRole=ROLE_ID&sessionRole=ROLE_ID`
        );
        const res1 = await request(app.getHttpServer()).get(`${base}/get-user`).set('Authorization', `Bearer ${token}`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const {
          body: {
            result2: { token: newToken }
          }
        } = await request(app.getHttpServer()).get(`${base}/refresh`).set('Cookie', cookie);

        const res2 = await request(app.getHttpServer())
          .get(`${base}/get-user`)
          .set('Authorization', `Bearer ${newToken}`);

        expect(res1.body).toEqual({ user2: { jwtRole2: 'ROLE_ID', userId2: userId } });
        expect(token).not.toEqual(newToken);
        expect(res1.body).toEqual(res2.body);
      });
    });
  });
});
