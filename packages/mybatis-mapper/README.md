# @nestjs-kitchen/mybatis-mapper

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fmybatis-mapper)
](https://www.npmjs.com/package/@nestjs-kitchen/mybatis-mapper)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fmybatis-mapper)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/mybatis-mapper)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A [mybatis mapper](https://www.npmjs.com/package/mybatis-mapper) in NextJS.

---

## Install

```bash
$ npm install --save @nestjs-kitchen/mybatis-mapper
```

## Usage

1. Auto load/watch mappers from specified folder:

    ```ts
    // app.module.ts
    import { MybatisMapperModule } from "mybatis";
    import { AppService } from "./app.service";

    @Module({
        // load and watch mappers from specified folder.
      imports: [MybatisMapperModule.register({ patterns: "./mapper", watchPatterns: "./mapper" })],
      controllers: [],
      providers: [AppService],
    })
    export class AppModule {}
    ```

2. get sql from mappers:

    ```ts
    // app.service.ts
    import { Injectable } from '@nestjs/common';
    import { MybatisMapper } from 'mybatis';

    @Injectable()
    export class AppService {
      constructor(private mapper: MybatisMapper){}

      getSql(): string {
        const param = {
          category : 'apple',
          price : 100
        }

        return this.mapper.getStatement('fruit', 'testIf', param, { language: 'sql', indent: '  ' }
      }
    }
    ```

## License

MIT License