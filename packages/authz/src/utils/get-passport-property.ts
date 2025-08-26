import { PASSPORT_PROPERTY } from '../constants';

export const getPassportProperty = <T>(request: any): T => {
  return request[request[PASSPORT_PROPERTY] as string];
};
