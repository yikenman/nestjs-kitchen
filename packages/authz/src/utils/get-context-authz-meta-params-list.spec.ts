import { isNotFalsy } from './generics';
import { getContextAuthzMetaParamsList } from './get-context-authz-meta-params-list';
import type { AuthzMetaParams } from './types';

jest.mock('./generics', () => {
  const actual = jest.requireActual('./generics');
  return {
    ...actual,
    isNotFalsy: jest.fn(actual.isNotFalsy)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Get context authz meta params list', () => {
  const authzMetaNormal1: AuthzMetaParams = {
    metaData: { key: 'value1' },
    options: { public: false, override: false }
  };
  const authzMetaNormal2: AuthzMetaParams = {
    metaData: { key: 'value2' },
    options: { public: false, override: false }
  };
  const authzMetaOverride: AuthzMetaParams = {
    metaData: { key: 'value3' },
    options: { public: false, override: true }
  };
  const authzMetaFalsy: AuthzMetaParams = {
    metaData: undefined,
    options: { public: false, override: false }
  };
  const authzMetaPublic: AuthzMetaParams = { metaData: null, options: { public: true, override: true } };

  it('should return authz meta params', () => {
    const authzMetaCollection = [authzMetaNormal1, authzMetaNormal2];

    const result = getContextAuthzMetaParamsList(authzMetaCollection);
    expect(result).toEqual(authzMetaCollection);
  });

  it('should return authz meta params when metaData and options are undefined', () => {
    const authzMetaCollection = [{ metaData: undefined, options: undefined }];

    const result = getContextAuthzMetaParamsList(authzMetaCollection);
    expect(result).toEqual(authzMetaCollection);
  });

  it('should return authz meta params starting from last override index if defaultOverride is false', () => {
    const authzMetaCollection = [authzMetaNormal1, authzMetaOverride, authzMetaNormal2];

    const result = getContextAuthzMetaParamsList(authzMetaCollection, { defaultOverride: false });
    expect(result).toEqual([authzMetaOverride, authzMetaNormal2]);
  });

  it('should start from the last item if defaultOverride is true', () => {
    const authzMetaCollection = [authzMetaNormal1, authzMetaOverride, authzMetaNormal2];
    const result = getContextAuthzMetaParamsList(authzMetaCollection, { defaultOverride: true });
    expect(result).toEqual([authzMetaNormal2]);
  });

  it('should skip falsy metadata when skipFalsyMetadata is true', () => {
    const authzMetaCollection = [authzMetaNormal1, authzMetaFalsy, authzMetaNormal2];

    const result = getContextAuthzMetaParamsList(authzMetaCollection, { skipFalsyMetadata: true });
    expect(isNotFalsy).toHaveBeenCalled();
    expect(result).toEqual([authzMetaNormal1, authzMetaNormal2]);
  });

  it('should include falsy items if skipFalsyMetadata is false', () => {
    const authzMetaCollection = [authzMetaNormal1, authzMetaFalsy, authzMetaNormal2];

    const result = getContextAuthzMetaParamsList(authzMetaCollection, { skipFalsyMetadata: false });
    expect(result).toEqual(authzMetaCollection);
  });

  it('should exclude all public items', () => {
    const authzMetaCollection = [authzMetaNormal1, authzMetaPublic, authzMetaNormal2];

    const result = getContextAuthzMetaParamsList(authzMetaCollection);
    expect(result).toEqual([authzMetaNormal2]);
  });

  it('should return empty array if only one public items', () => {
    const authzMetaCollection = [authzMetaPublic];

    const result = getContextAuthzMetaParamsList(authzMetaCollection);
    expect(result).toEqual([]);
  });
});
