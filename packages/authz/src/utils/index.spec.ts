import * as index from './index';

describe('Index', () => {
  it('should export allowed modules', () => {
    expect(index).toHaveProperty('createAuthzDecoratorFactory');
    expect(index).toHaveProperty('createOnceAdapterShimProvider');
    expect(index).toHaveProperty('createSetCookieFn');
    expect(index).toHaveProperty('customCookieParser');
    expect(index).toHaveProperty('decodeMsgpackrString');
    expect(index).toHaveProperty('encodeMsgpackrString');
    expect(index).toHaveProperty('getAllowAnonymous');
    expect(index).toHaveProperty('getAlsStore');
    expect(index).toHaveProperty('getContextAuthzMetaParamsList');
    expect(index).toHaveProperty('getPassportProperty');
    expect(index).toHaveProperty('isNotFalsy');
    expect(index).toHaveProperty('mergeDynamicModuleConfigs');
    expect(index).toHaveProperty('normalCookieParser');
    expect(index).toHaveProperty('normalizedArray');
    expect(index).toHaveProperty('normalizedObject');
    expect(index).toHaveProperty('safeClone');
  });
});
