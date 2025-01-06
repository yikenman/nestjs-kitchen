import { DEFAULT_INSTANCE_NAME } from '../constants';

export const normalizeConnections = <T extends { name?: string }>(connections: T[] | T, defaultName?: string) => {
  const list = (Array.isArray(connections) ? connections : [connections]).map((ele) => ({
    ...ele,
    name: ele.name ?? defaultName ?? DEFAULT_INSTANCE_NAME
  }));

  return Object.entries(
    list.reduce<Record<string, Omit<T, 'name'>>>((obj, ele) => {
      const { name, ...options } = ele;

      if (obj[name]) {
        console.warn(`Warning: Property '${name}' is being redefined. The previous value will be overwritten.`);
      }

      obj[name] = options;
      return obj;
    }, {})
  );
};
