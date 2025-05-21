import { Module } from '@nestjs/common';
import Tokens from 'csrf';
import { CSRF_DEFAULT_OPTIONS, CSRF_INSTANCE, CSRF_OPTIONS } from './constants';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './module-builder';
import type { CsrfDoubleCsrfOptions, CsrfModuleOptions, CsrfOptions, CsrfSessionOptions } from './types';

@Module({
  providers: [
    {
      provide: CSRF_OPTIONS,
      useFactory: (moduleOptions: CsrfModuleOptions) => {
        const options: { [key: string]: any } = {
          ...CSRF_DEFAULT_OPTIONS,
          ...moduleOptions,
          cookieOptions: {
            ...(CSRF_DEFAULT_OPTIONS as CsrfDoubleCsrfOptions).cookieOptions,
            ...(moduleOptions as CsrfDoubleCsrfOptions).cookieOptions
          }
        };

        options.verifyMethodsSet = new Set(options.verifyMethods);
        return options;
      },
      inject: [MODULE_OPTIONS_TOKEN]
    },
    {
      provide: CSRF_INSTANCE,
      useFactory: (options: Required<CsrfModuleOptions>) => {
        return new Tokens({ saltLength: options.saltLength, secretLength: options.secretLength });
      },
      inject: [CSRF_OPTIONS]
    }
  ],
  exports: [CSRF_OPTIONS, CSRF_INSTANCE]
})
export class CsrfModule extends ConfigurableModuleClass {}
