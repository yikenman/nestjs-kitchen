import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  type OnModuleInit,
  Optional,
  SetMetadata,
  UseInterceptors
} from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Observable } from 'rxjs';
import { PROXY_METADATA_ENABLE, PROXY_METADATA_OPTIONS, PROXY_OPTIONS } from './constant';
import { proxyStore } from './proxy-store';
import type { ProxyOptions } from './types';
import { getAdaptorMethods, isEmptyObjectShallow } from './utils';

@Injectable()
export class ProxyInterceptor implements NestInterceptor, OnModuleInit {
  private methods: ReturnType<typeof getAdaptorMethods>;

  constructor(
    private httpAdapterHost: HttpAdapterHost,
    private readonly reflector: Reflector,
    @Optional()
    @Inject(PROXY_OPTIONS)
    private readonly defaultOptions?: ProxyOptions
  ) {}

  onModuleInit() {
    const adapter = this.httpAdapterHost?.httpAdapter?.constructor?.name;
    this.methods = getAdaptorMethods(adapter);

    if (!this.methods) {
      throw new Error(`Unsupported HTTP adapter: cannot resolve method bindings for ${adapter}.`);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const [controller, handler] = [context.getClass(), context.getHandler()];

    const enableProxy = this.reflector.getAll<(true | undefined)[]>(PROXY_METADATA_ENABLE, [controller, handler]);
    if (!enableProxy.some(Boolean)) {
      return next.handle();
    }

    const [controllerOptions, handlerOptions] = this.reflector.getAll<(ProxyOptions | undefined)[]>(
      PROXY_METADATA_OPTIONS,
      [controller, handler]
    );

    const mergedOptions = {
      ...this.defaultOptions,
      ...controllerOptions,
      ...handlerOptions
    };

    if (isEmptyObjectShallow(mergedOptions)) {
      return next.handle();
    }

    const storeKey = handlerOptions ? handler : controller;

    const proxy = this.getProxyInstance(storeKey, mergedOptions);
    const req = this.getRawRequest(context);
    const res = this.getRawResponse(context);

    return new Observable((observer) => {
      proxy(req, res, (err: unknown) => {
        // unreachable
        if (err) {
          observer.error(err);
        } else {
          next.handle().subscribe(observer);
        }
      });
    });
  }

  getProxyInstance(key: any, options: ProxyOptions) {
    let proxy = proxyStore.get(key);
    if (!proxy) {
      proxy = createProxyMiddleware(options);
      proxyStore.set(key, proxy);
    }

    return proxy;
  }

  /**
   * return raw request
   */
  getRawRequest(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // fallback to req itself if `rawBody:false`
    return req.rawBody ?? this.methods.getRawRequest(req);
  }

  /**
   * return raw response
   */
  getRawResponse(context: ExecutionContext) {
    const res = context.switchToHttp().getResponse();
    return this.methods.getRawRespone(res);
  }

  /**
   * Returns the proxy options. When creating a proxy instance, the options
   * are merged in order: module-level, controller-level, then handler-level.
   *
   * **Note: The merge is shallow; nested objects are not merged recursively.**
   */
  static Options(options?: ProxyOptions) {
    return applyDecorators(SetMetadata(PROXY_METADATA_OPTIONS, options), SetMetadata(PROXY_METADATA_ENABLE, true));
  }

  /**
   * Equivalent to calling ProxyInterceptor.Options and UseInterceptors(ProxyInterceptor) together.
   */
  static Use(options?: ProxyOptions) {
    return applyDecorators(
      SetMetadata(PROXY_METADATA_OPTIONS, options),
      SetMetadata(PROXY_METADATA_ENABLE, true),
      UseInterceptors(ProxyInterceptor)
    );
  }
}
