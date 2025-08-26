import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getPassportProperty } from './utils';

export const userDecoratorFactory = (_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();

  return getPassportProperty<unknown>(request);
};

/**
 * Retrieves the current user associated with the request, if available.
 *
 * ### Usage
 *
 * ```typescript
 * ⁣@UseGuards(AuthzGuard)
 * ⁣@Controller(/⁣/ ...)
 * export class BusinessController {
 *  ⁣@Get()
 *  async method(@User() user: User) {
 *    // ...
 *  }
 * }
 * ```
 */
export const User = createParamDecorator(userDecoratorFactory);
