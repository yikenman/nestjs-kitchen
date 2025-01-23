import { withResolvers } from './utils';

describe('Promise.withResolvers Assignment', () => {
  let originalWithResolvers: (typeof Promise)['withResolvers'];

  beforeAll(() => {
    // 保存原始的 Promise.withResolvers
    originalWithResolvers = Promise.withResolvers;
  });

  afterAll(() => {
    // 恢复原始的 Promise.withResolvers
    Promise.withResolvers = originalWithResolvers;
  });

  it('should assign withResolvers if Promise.withResolvers is undefined', () => {
    // @ts-ignore
    delete Promise.withResolvers;

    expect(Promise.withResolvers).toBeUndefined();

    Promise.withResolvers ??= withResolvers;

    expect(Promise.withResolvers).toBe(withResolvers);
  });

  it('should not overwrite existing Promise.withResolvers', () => {
    const mockWithResolvers = jest.fn();
    Promise.withResolvers = mockWithResolvers;

    Promise.withResolvers ??= withResolvers;

    expect(Promise.withResolvers).toBe(mockWithResolvers);
  });
});
