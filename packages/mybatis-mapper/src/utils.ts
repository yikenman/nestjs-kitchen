export const isEmptyObject = (obj: unknown) => {
  if (obj === undefined || obj === null) {
    return true;
  }

  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => obj[key] === undefined);
};
