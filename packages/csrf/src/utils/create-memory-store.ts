export interface MemoryStore<T = string> {
  set(key: string, value: T, ttl?: number): void;
  get(key: string): T | undefined;
  del(key: string): void;
  has(key: string): boolean;
  clear(): void;
}

export function createMemoryStore<T = string>(): MemoryStore<T> {
  const store = new Map<string, { value: T; expiresAt?: number }>();

  const now = () => Date.now();

  const cleanup = () => {
    const current = now();
    for (const [key, { expiresAt }] of store.entries()) {
      if (expiresAt !== undefined && expiresAt <= current) {
        store.delete(key);
      }
    }
  };

  return {
    set(key, value, ttl) {
      cleanup();
      const expiresAt = ttl ? now() + ttl : undefined;
      store.set(key, { value, expiresAt });
    },

    get(key) {
      cleanup();
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      return entry.value;
    },

    del(key) {
      store.delete(key);
    },

    has(key) {
      cleanup();
      return store.has(key);
    },

    clear() {
      store.clear();
    }
  };
}
