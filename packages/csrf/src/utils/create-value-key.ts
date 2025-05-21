import { CSRF_KEY_PREFIX } from '../constants';

export const createValueKey = (sessionId: string, token: string) => {
  return `${CSRF_KEY_PREFIX}:${sessionId}:${token}`;
};
