# @nestjs-kitchen/connextion-duckdb

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fconnextion-duckdb)
](https://www.npmjs.com/package/@nestjs-kitchen/connextion-duckdb)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fconnextion-duckdb)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/connextion-duckdb)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A flexible module to provide [@duckdb/node-api](https://www.npmjs.com/package/@duckdb/node-api) interface in NextJS.

---

## Install

```bash
$ npm install --save @nestjs-kitchen/connextion @nestjs-kitchen/connextion-duckdb @duckdb/node-api
```

## Usage

### Apply `DuckDBModule`

1. Export module, service & decorator. 

    ```typescript
    export const { DuckDB, DuckDBModule } = defineDuckDB();
    export type DuckDB = InstanceType<typeof DuckDB>;
    ```

2. Register duckDB connection instance with options.

    ```typescript
    @Module({
      imports: [
        // By default it will register a connection instance called `default`.
        DuckDBModule.register({
          connections: {
            path: ':memory:'
          }
        })
      ],
      providers: [SampleService]
    })
    export class SampleModule {} 
    ```

3. Inject `DuckDB` service.

    ```typescript
    import { DuckDB } from './file-that-exported-duckdb';
    
    @Injectable()
    class SampleService {
      constructor(
        private readonly duckDB: DuckDB,
      ) {}
    
      async sampleMethod() {
        const result = await this.duckDB.default.run('from target_table');
      }
    }
    ```

### Register multiple duckDB instances

1. Define duckDB connection instance names and export module, service & decorator. 

    e.g.: `instance_1`,`instance_2`.

    ```typescript
    export const { DuckDB, DuckDBModule } = defineDuckDB<'instance_1' | 'instance_2'>();
    export type DuckDB = InstanceType<typeof DuckDB>;
    ```

2. Register duckDB connection instances with options.

    ```typescript
    @Module({
      imports: [
        DuckDBModule.register({
          connections: [
            {
              name: 'instance1',
              // instance_1's options...
            },
            {
              name: 'instance2',
              // instance_2's options...
            }
          ]
        })
      ],
      providers: [SampleService]
    })
    export class SampleModule {} 
    ```

3. Inject `DuckDB` service.

    ```typescript
    import { DuckDB } from './file-that-exported-duckdb';
    
    @Injectable()
    class SampleService {
      constructor(
        private readonly duckDB: DuckDB,
      ) {}
    
      async sampleMethod() {
        const result = await this.duckDB.instance1.run('from target_table');
      }
    }
    ```


### API

#### run

```typescript
import { DuckDB } from './file-that-exported-duckdb';

@Injectable()
class SampleService {
  constructor(
    private readonly duckDB: DuckDB,
  ) {}

  async sampleMethod() {
    const result = await this.duckDB.default.run('from target_table');
  }
}
```

#### runAndRead

```typescript
import { DuckDB } from './file-that-exported-duckdb';

@Injectable()
class SampleService {
  constructor(
    private readonly duckDB: DuckDB,
  ) {}

  async sampleMethod() {
    const reader = await this.duckDB.default.runAndRead('from target_table');
  }
}
```

#### stream

```typescript
import { DuckDB } from './file-that-exported-duckdb';

@Injectable()
class SampleService {
  constructor(
    private readonly duckDB: DuckDB,
  ) {}

  async sampleMethod() {
    const result = await this.duckDB.default.stream('from target_table');
  }
}
```

#### streamAndRead

```typescript
import { DuckDB } from './file-that-exported-duckdb';

@Injectable()
class SampleService {
  constructor(
    private readonly duckDB: DuckDB,
  ) {}

  async sampleMethod() {
    const reader = await this.duckDB.default.streamAndRead('from target_table');
  }
}
```

#### createAppender

```typescript
import { DuckDB } from './file-that-exported-duckdb';

@Injectable()
class SampleService {
  constructor(
    private readonly duckDB: DuckDB,
  ) {}

  async sampleMethod() {
    await this.duckDB.default.run(`create or replace table target_table(i integer, v varchar)`);
    const appender = await this.duckDB.default.createAppender('target_table');

    appender.appendInteger(42);
    appender.appendVarchar('duck');
    appender.endRow();

    appender.appendInteger(123);
    appender.appendVarchar('mallard');
    appender.endRow();

    appender.flush();

    appender.appendInteger(17);
    appender.appendVarchar('goose');
    appender.endRow();

    appender.close();
  }
}
```

#### result

see [Inspect Result](https://duckdb.org/docs/stable/clients/node_neo/overview#inspect-result)

#### reader

see [Result Reader](https://duckdb.org/docs/stable/clients/node_neo/overview#result-reader)

## License

MIT License