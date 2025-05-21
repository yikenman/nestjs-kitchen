import { CanActivate, ExecutionContext, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import type Tokens from 'csrf';
import {
  CSRF_INSTANCE,
  CSRF_METADATA_NO_VERIFY,
  CSRF_METADATA_SIGN,
  CSRF_METADATA_VERIFY,
  CSRF_OPTIONS
} from './constants';
import { CsrfError, CsrfInvalidError, CsrfMismatchError, CsrfMissingError } from './errors';
import type { CsrfDoubleCsrfOptions, CsrfOptions, CsrfSessionOptions } from './types';
import { createValueKey, getAdaptorMethods } from './utils';

@Injectable()
export class CsrfGuard implements CanActivate, OnModuleInit {
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

  isTargetMethod(req: any) {
    return this.options.verifyMethodsSet.has(this.methods.getHttpMethod(req));
  }

  shouldVerify(context: ExecutionContext, req: any) {
    const noVerifyMetaData = this.reflector.getAll<boolean[]>(CSRF_METADATA_NO_VERIFY, [
      context.getClass(),
      context.getHandler()
    ]);

    const signMetaData = this.reflector.getAll<boolean[]>(CSRF_METADATA_SIGN, [
      context.getClass(),
      context.getHandler()
    ]);

    const verifyMetaData = this.reflector.getAll<boolean[]>(CSRF_METADATA_VERIFY, [
      context.getClass(),
      context.getHandler()
    ]);

    if (noVerifyMetaData[1] || signMetaData[1]) {
      return false;
    }

    if (!verifyMetaData[1] && (noVerifyMetaData[0] || signMetaData[0])) {
      return false;
    }

    return verifyMetaData.some(Boolean) || this.isTargetMethod(req);
  }

  async getOneTimeTokenSecret(req: any, token: string, options: Required<CsrfSessionOptions>) {
    const sessionId = this.methods.getSessionId(req);
    if (!sessionId) {
      throw new CsrfError('Session ID not found. Is session support properly configured?');
    }

    const key = createValueKey(sessionId, token);

    let secret: string = '';
    try {
      secret = await options.nonceStore.get(key);
    } catch (error) {
      throw new CsrfError(error);
    }

    // delete once get
    if (secret) {
      try {
        await options.nonceStore.del(key);
      } catch (error) {
        throw new CsrfError(error);
      }
    }

    return secret;
  }

  getSecret(req: any, token: string): Promise<string> | string {
    switch (this.options.type) {
      case 'double-csrf':
        if (!this.methods.isCookieAvailable(req)) {
          throw new CsrfError(
            'Cookie support is required for double-csrf mode. Is the cookie middleware/plugin registered?'
          );
        }

        return this.methods.getCookie(req, this.options.cookieKey, this.options.cookieOptions.signed);

      case 'session':
        if (!this.methods.isSessionAvailable(req)) {
          throw new CsrfError(
            'Session support is required for session mode. Is the session middleware/plugin registered?'
          );
        }

        if (this.options.oneTimeToken) {
          return this.getOneTimeTokenSecret(req, token, this.options);
        }
        return this.methods.getSession(req, this.options.sessionKey);
      default:
        return '';
    }
  }

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    if (!this.shouldVerify(context, req)) {
      return true;
    }

    const token = this.options.getToken(req);
    if (!token) {
      throw new CsrfMissingError('Missing CSRF token');
    }

    const secret = await this.getSecret(req, token);
    if (!secret) {
      throw new CsrfMismatchError('Token mismatch');
    }

    if (!this.tokens.verify(secret, token)) {
      throw new CsrfInvalidError('Invalid CSRF token');
    }

    return true;
  }
}
