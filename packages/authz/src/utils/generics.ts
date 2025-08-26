export const isNotFalsy = <T>(val: T): val is T => {
  return val !== undefined && val !== null && !Number.isNaN(val);
};

export const normalizedArray = <T>(val?: T | T[]): undefined extends T ? T[] | undefined : NonNullable<T>[] => {
  if (!val) {
    return undefined as any;
  }

  return (Array.isArray(val) ? val : [val]).filter(isNotFalsy) as any;
};

export const normalizedObject = <T extends Record<string, any>>(obj?: T) => {
  if (!obj) {
    return undefined;
  }
  const entries = Object.entries(obj);
  if (!entries.length) {
    return undefined;
  }
  const filtered = entries.filter(([_, value]) => value !== undefined);
  if (!filtered.length) {
    return undefined;
  }
  return Object.fromEntries(filtered) as T;
};
