# @nestjs-kitchen/headers

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fheaders)
](https://www.npmjs.com/package/@nestjs-kitchen/headers)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fheaders)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/headers)](https://codecov.io/gh/yikenman/nestjs-kitchen)

An convenient way to add custom HTTP headers.

---

## Install

```bash
$ npm install --save @nestjs-kitchen/headers
```

## Usage

### Example

Register module:

```ts
// in app.module.ts
@Module({
  imports: [
    // ...
    HeadersModule.register({
      headers: {
        'X-Custom-Header': 'custom-value'
      }
    }),
    // ...
  ],
})
export class AppModule {}
```

### Options

| Option      | Type                                                     | Default  | Description                                                                                                                 |
| ----------- | -------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `headers`   | `Headers \| ((req: any) => Headers \| Promise<Headers>)` | required | HTTP headers to set. Can be a static object or a function that dynamically computes headers based on the request.           |
| `include`   | `(string \| RegExp)[]`                                   | —        | Optional path inclusion filter. Headers will only be applied to matching requests.                                          |
| `exclude`   | `(string \| RegExp)[]`                                   | —        | Path exclusion filter. Has higher priority than `include`. Requests matching any exclude pattern will skip setting headers. |
| `overwrite` | `boolean`                                                | `false`  | Whether to overwrite existing headers. If false, headers will only be set if they do not already exist.                     |
| `debug`     | `boolean`                                                | `false`  | Enable debug logging. When true, debug information will be logged to the configured logger.                                 |


## License

MIT License