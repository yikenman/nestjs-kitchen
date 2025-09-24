import { Test, TestingModule } from '@nestjs/testing';
import { PROXY_OPTIONS } from './constant';
import { ProxyModule } from './proxy.module';

describe('ProxyModule', () => {
  let module: TestingModule;

  const mockOptions = {
    target: 'http://localhost:3000',
    changeOrigin: true
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ProxyModule.register({
          options: mockOptions
        })
      ]
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide PROXY_OPTIONS', () => {
    const proxyOptions = module.get(PROXY_OPTIONS);
    expect(proxyOptions).toEqual(mockOptions);
  });
});
