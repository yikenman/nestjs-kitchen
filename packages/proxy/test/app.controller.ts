import { All, Controller, UseInterceptors } from '@nestjs/common';
import { ProxyInterceptor } from '../src';

@UseInterceptors(ProxyInterceptor)
@Controller()
export class AppController {
  @ProxyInterceptor.Use({
    headers: { 'x-handler': 'ok' },
    pathRewrite: { '^/proxy-api': '' }
  })
  @All('/proxy-api/*')
  proxyApi() {
    return { ok: true };
  }

  @All('/non-proxy-api/*')
  nonProxyApi() {
    return { ok: true };
  }
}
