import { PASSPORT_PROPERTY } from '../constants';

export const getPassportProperty = <T>(request: Express.Request): T => {
  // @ts-ignore
  return request[request[PASSPORT_PROPERTY] as string];
};
