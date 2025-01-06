export const joinStrs = (...strs: string[]) => {
  return strs.filter(Boolean).join('_');
};
