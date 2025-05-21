const adaptorMethods = {
  ExpressAdapter: {
    getSession(req: any, key: string) {
      return req.session[key];
    },
    getSessionId(req: any) {
      return req.session.id;
    },
    setSession(req: any, key: string, value: any) {
      req.session[key] = value;
    },
    isSessionAvailable(req: any) {
      return !!req.session;
    },
    getCookie(req: any, key: string, signed = true) {
      return signed ? req?.signedCookies?.[key] : req?.cookies?.[key];
    },
    setCookie(res: any, key: string, value: string, options?: Record<string, any>) {
      res.cookie(key, value, options);
    },
    isCookieAvailable(req: any) {
      return !!req.cookies;
    },
    setHeader(res: any, key: string, value: string) {
      res.set(key, value);
    },
    getHttpMethod(req: any) {
      return (req.method as string).toUpperCase();
    }
  },
  FastifyAdapter: {
    getSession(req: any, key: string) {
      return req.session.get(key);
    },
    getSessionId(req: any) {
      return req.session.sessionId;
    },
    setSession(req: any, key: string, value: any) {
      req.session.set(key, value);
    },
    isSessionAvailable(req: any) {
      return !!req.session;
    },
    getCookie(req: any, key: string, signed = true) {
      const value = req?.cookies?.[key];

      return signed && value ? req.unsignCookie(value)?.value : value;
    },
    setCookie(res: any, key: string, value: string, options?: Record<string, any>) {
      res.setCookie(key, value, options);
    },
    isCookieAvailable(req: any) {
      return !!req.cookies;
    },
    setHeader(res: any, key: string, value: string) {
      res.header(key, value);
    },
    getHttpMethod(req: any) {
      return (req.method as string).toUpperCase();
    }
  }
};

export const getAdaptorMethods = (adaptor: string) => {
  return adaptorMethods[adaptor as keyof typeof adaptorMethods];
};
