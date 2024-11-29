import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { getPassportProperty } from './utils';

export const userDecoratorFactory = (_data: unknown, ctx: ExecutionContext) => {
  const request: Request = ctx.switchToHttp().getRequest();

  return getPassportProperty<unknown>(request);
};

export const User = createParamDecorator(userDecoratorFactory);
