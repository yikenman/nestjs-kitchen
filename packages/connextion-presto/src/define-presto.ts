import type { DynamicModule, Type } from '@nestjs/common';
import {
  type AsyncModuleOptions,
  type ConnectionOptionName,
  type ConnextionInstance,
  defineConnextionBuilder,
  type ModuleOptions
} from '@nestjs-kitchen/connextion';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { PrestoInstance } from './presto.instance';
import type { PrestoInstanceOptions } from './types';

const innerDefinePresto = defineConnextionBuilder({
  connextionName: 'Presto',
  InstanceClass: PrestoInstance,
  defaultInstanceName: DEFAULT_INSTANCE_NAME
});

/**
 * Creates a set of Presto services and modules.
 */
export const definePresto = <T extends string = typeof DEFAULT_INSTANCE_NAME>() => {
  const { Presto, PrestoModule } = innerDefinePresto<T>();

  return {
    /**
     * The Presto service, responsible for managing all presto connection instances registered by the module.
     */
    Presto,
    /**
     * The Presto module, used to register and create presto connection instances with options.
     *
     * This module can be configured using 2 static methods:
     *
     * - `register`
     * - `registerAsync`
     *
     */
    PrestoModule
  };
};
