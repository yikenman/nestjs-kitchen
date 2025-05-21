import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import type Tokens from 'csrf';
import { type Observable, mergeMap } from 'rxjs';
import { CSRF_INSTANCE, CSRF_METADATA_SIGN, CSRF_OPTIONS } from './constants';
import { CsrfError } from './errors';
import type { CsrfDoubleCsrfOptions, CsrfOptions, CsrfSessionOptions } from './types';
import { createValueKey, getAdaptorMethods } from './utils';

@Injectable()
export class CsrfInterceptor implements NestInterceptor, OnModuleInit {
  private methods: ReturnType<typeof getAdaptorMethods>;

  constructor(
    @Inject(CSRF_OPTIONS) private options: Required<CsrfDoubleCsrfOptions & CsrfSessionOptions & CsrfOptions>,
    @Inject(CSRF_INSTANCE) private tokens: Tokens,
    private httpAdapterHost: HttpAdapterHost,
    protected readonly reflector: Reflector
  ) {}

  onModuleInit() {
    const adapter = this.httpAdapterHost?.httpAdapter?.constructor?.name;
    this.methods = getAdaptorMethods(adapter);

    if (!this.methods) {
      throw new Error(`Unsupported HTTP adapter: cannot resolve method bindings for ${adapter}.`);
    }
  }

  shouldSign(context: ExecutionContext) {
    return this.reflector
      .getAll<boolean[]>(CSRF_METADATA_SIGN, [context.getClass(), context.getHandler()])
      .some(Boolean);
  }

  async setOneTimeTokenSecret(
    req: any,
    secret: string,
    token: string,
    options: Required<CsrfSessionOptions & CsrfOptions>
  ) {
    const sessionId = this.methods.getSessionId(req);
    if (!sessionId) {
      throw new CsrfError('Session ID not found. Is session support properly configured?');
    }

    try {
      await options.nonceStore.set(createValueKey(sessionId, token), secret, options.oneTimeTokenTTL);
    } catch (error) {
      throw new CsrfError(error);
    }
  }

  async setSecretAndToken(req: any, res: any) {
    const secret = await this.tokens.secret();
    const token = this.tokens.create(secret);

    switch (this.options.type) {
      case 'double-csrf':
        if (!this.methods.isCookieAvailable(req)) {
          throw new CsrfError(
            'Cookie support is required for double-csrf mode. Is the cookie middleware/plugin registered?'
          );
        }

        this.methods.setCookie(res, this.options.cookieKey, secret, this.options.cookieOptions);
        break;

      case 'session':
        if (!this.methods.isSessionAvailable(req)) {
          throw new CsrfError(
            'Session support is required for session mode. Is the session middleware/plugin registered?'
          );
        }

        this.methods.setSession(req, this.options.sessionKey, secret);

        if (this.options.oneTimeToken) {
          this.methods.setSession(req, this.options.sessionKey, true);
          await this.setOneTimeTokenSecret(req, secret, token, this.options);
        }
        break;

      default:
        return;
    }

    this.methods.setHeader(res, this.options.headerKey, token);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.shouldSign(context)) {
      return next.handle();
    }

    const res = context.switchToHttp().getResponse();
    const req = context.switchToHttp().getRequest();

    return next.handle().pipe(
      mergeMap(async (value) => {
        await this.setSecretAndToken(req, res);
        return value;
      })
    );
  }
}
