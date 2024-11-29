import { SetMetadata } from '@nestjs/common';
import { createAuthzDecoratorFactory } from './create-authz-decorator-factory';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    SetMetadata: jest.fn(actual.SetMetadata)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Create authz decorator factroy', () => {
  const metaKey = 'metaKey';
  const metaData = { someMetaData: 'value' };
  const optionsList = [
    {
      override: true
    },
    {
      allowAnonymous: true
    },
    {
      override: true,
      allowAnonymous: true
    }
  ];

  describe('createAuthzDecoratorFactory', () => {
    let Authz: ReturnType<typeof createAuthzDecoratorFactory>;

    beforeEach(() => {
      Authz = createAuthzDecoratorFactory(metaKey);
    });

    it('should apply metadata with metadata and options', () => {
      const options = {
        override: true,
        allowAnonymous: true
      };
      // @ts-ignore
      const result = Authz(metaData, options);

      expect(SetMetadata).toHaveBeenCalledTimes(1);
      expect(SetMetadata).toHaveBeenCalledWith(metaKey, { metaData, options });

      expect(result).toBeDefined();
    });

    it('should apply metadata without parameters', () => {
      // @ts-ignore
      const result = Authz();

      expect(SetMetadata).toHaveBeenCalledTimes(1);
      expect(SetMetadata).toHaveBeenCalledWith(metaKey, { metaData: undefined, options: undefined });

      expect(result).toBeDefined();
    });

    it('should apply metadata when first parameter satisfy options structure', () => {
      const firstParameterList = optionsList;

      firstParameterList.forEach((firstParameter, i) => {
        // @ts-ignore
        Authz(firstParameter);
        expect(SetMetadata).toHaveBeenNthCalledWith(i + 1, metaKey, { metaData: undefined, options: firstParameter });
      });
    });

    it('should apply metadata when first parameter does not satisfy options structure', () => {
      const firstParameterList = [...optionsList.map((ele) => ({ ...ele, ...metaData })), metaData];

      firstParameterList.forEach((firstParameter, i) => {
        // @ts-ignore
        Authz(firstParameter);
        expect(SetMetadata).toHaveBeenNthCalledWith(i + 1, metaKey, {
          metaData: firstParameter,
          options: undefined
        });
      });
    });
  });
});
