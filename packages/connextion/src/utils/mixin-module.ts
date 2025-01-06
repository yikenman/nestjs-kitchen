import { Module, type Type } from '@nestjs/common';

export function mixinModule<T>(name: string, mixinClass: Type<T>) {
  Object.defineProperty(mixinClass, 'name', {
    value: name
  });
  Module({})(mixinClass);
  return mixinClass;
}
