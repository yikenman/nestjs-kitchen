import { type Options } from 'http-proxy-middleware';

export type ProxyOptions = Options;
export type ProxyModuleOptions = {
  /**
   * provide default values for the options
   */
  options?: ProxyOptions;
};
