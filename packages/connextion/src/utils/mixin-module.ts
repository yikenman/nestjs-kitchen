import { Module, type Type } from '@nestjs/common';
import { uid } from 'uid';

export function mixinModule<T>(mixinClass: Type<T>) {
  Object.defineProperty(mixinClass, 'name', {
    value: uid(21)
  });
  Module({})(mixinClass);
  return mixinClass;
}
