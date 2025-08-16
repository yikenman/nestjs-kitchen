import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { User, userDecoratorFactory } from './user.decorator';
import { getPassportProperty } from './utils';

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');

  return {
    ...actual,
    getPassportProperty: jest.fn(actual.getPassportProperty)
  };
});

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    createParamDecorator: jest.fn(actual.createParamDecorator)
  };
});

describe('User Decorator', () => {
  describe('userDecoratorFactory', () => {
    it('should return user from request', () => {
      const mockUser = { id: 1, name: 'Test User' };
      const mockRequest = {
        user: mockUser
      };
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest
        })
      } as unknown as ExecutionContext;

      jest.mocked(getPassportProperty).mockReturnValue(mockUser);

      const user = userDecoratorFactory(null, mockExecutionContext);

      expect(getPassportProperty).toHaveBeenCalledWith(mockRequest);
      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(user).toBe(mockUser);
    });
  });

  describe('User', () => {
    it('should be defained', () => {
      expect(User).toBeDefined();
    });

    it('should call createParamDecorator with userDecoratorFactory', () => {
      expect(createParamDecorator).toHaveBeenCalledWith(userDecoratorFactory);
    });
  });
});
