export type HeaderValue = string | number | undefined | null;

export type Headers = Record<string, HeaderValue>;

export interface HeadersModuleOptions {
  /**
   * HTTP headers to set.
   * Can be a static object or a function that dynamically computes headers based on the request.
   */
  headers: Headers | ((req: any) => Headers | Promise<Headers>);

  /**
   * Optional path inclusion filter.
   * If provided, headers will only be applied to matching requests.
   */
  include?: (string | RegExp)[];

  /**
   * Path exclusion filter.
   * Has higher priority than `include`. Requests matching any exclude pattern will skip setting headers.
   */
  exclude?: (string | RegExp)[];

  /**
   * Whether to overwrite existing headers (default: false).
   * If false, headers will only be set if they do not already exist.
   */
  overwrite?: boolean;

  /**
   * Enable debug logging (default: false).
   * When true, debug information will be logged to the configured logger.
   */
  debug?: boolean;
}
