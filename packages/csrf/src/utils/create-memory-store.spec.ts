import { createMemoryStore } from './create-memory-store';

describe('MemoryStore', () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('should return a nonceStore', () => {
    expect(store).toBeDefined();
  });

  it('should set and get a value', () => {
    store.set('foo', 'bar');
    expect(store.get('foo')).toBe('bar');
  });

  it('should return undefined for unknown key', () => {
    expect(store.get('unknown')).toBeUndefined();
  });

  it('should delete a key', () => {
    store.set('foo', 'bar');
    store.del('foo');
    expect(store.get('foo')).toBeUndefined();
  });

  it('should check for existence', () => {
    store.set('foo', 'bar');
    expect(store.has('foo')).toBe(true);
    store.del('foo');
    expect(store.has('foo')).toBe(false);
  });

  it('should clear all keys', () => {
    store.set('foo', 'bar');
    store.set('baz', 'qux');
    store.clear();
    expect(store.get('foo')).toBeUndefined();
    expect(store.get('baz')).toBeUndefined();
  });

  it('should expire keys with ttl', async () => {
    store.set('foo', 'bar', 200);
    expect(store.get('foo')).toBe('bar');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.get('foo')).toBeUndefined();
  });

  it('should not expire keys without ttl', async () => {
    store.set('foo', 'bar');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.get('foo')).toBe('bar');
  });
});
