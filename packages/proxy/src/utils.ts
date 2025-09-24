export const isEmptyObjectShallow = (obj: Record<string, any>): boolean => {
  if (!obj || typeof obj !== 'object') return false;

  // object without properties
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return true;
  }

  // object has properties but value is undefined
  return keys.every((key) => obj[key] === undefined);
};

const adaptorMethods = {
  ExpressAdapter: {
    getRawRequest(req: any) {
      return req;
    },
    getRawRespone(res: any) {
      return res;
    }
  },
  FastifyAdapter: {
    getRawRequest(req: any) {
      return req.raw;
    },
    getRawRespone(res: any) {
      return res.raw;
    }
  }
};

export const getAdaptorMethods = (adaptor: string) => {
  return adaptorMethods[adaptor as keyof typeof adaptorMethods];
};
