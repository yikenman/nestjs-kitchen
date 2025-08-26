export const safeClone = (obj: any) => {
  if (!obj) {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return {};
  }
};
