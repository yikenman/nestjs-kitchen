# @nestjs-kitchen/connextion-postgres

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fconnextion-postgres)
](https://www.npmjs.com/package/@nestjs-kitchen/connextion-postgres)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fconnextion-postgres)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/connextion-postgres)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A flexible module to provide [node-postgres](https://node-postgres.com/) interface in NextJS.

---

## Feature

- ✅ Transaction support
- ✅ High availability (HA) support
- ✅ Type intelligent


## Install

```bash
$ npm install --save @nestjs-kitchen/connextion @nestjs-kitchen/connextion-postgres pg @types/pg
```

## Usage

### Apply `PostgresModule`

1. Export module, service & decorator. 

    ```typescript
    export const { Postgres, PostgresModule, Transaction } = definePostgres();
    export type Postgres = InstanceType<typeof Postgres>;
    ```

2. Register postgres connection instance with options.

    ```typescript
    @Module({
      imports: [
        // By default it will register a connection instance called `default`.
        PostgresModule.register({
          // default's options...
        })
      ],
      providers: [SampleService]
    })
    export class SampleModule {} 
    ```

3. Inject `Postgres` service.

    ```typescript
    import { Postgres } from './file-that-exported-postgres';
    
    @Injectable()
    class SampleService {
      constructor(
        private readonly postgres: Postgres,
      ) {}
    
      async sampleMethod() {
        const result1 = await this.postgres.default.query(`select 1=1;`);
      }
    }
    ```

### Register multiple postgres instances

1. Define postgres connection instance names and export module, service & decorator. 

    e.g.: `instance_1`,`instance_2`.

    ```typescript
    export const { Postgres, PostgresModule, Transaction } = definePostgres<'instance_1' | 'instance_2'>();
    export type Postgres = InstanceType<typeof Postgres>;
    ```

2. Register postgres connection instances with options.

    ```typescript
    @Module({
      imports: [
        PostgresModule.register({
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

3. Inject `Postgres` service.

    ```typescript
    import { Postgres } from './file-that-exported-postgres';
    
    @Injectable()
    class SampleService {
      constructor(
        private readonly postgres: Postgres,
      ) {}
    
      async sampleMethod() {
        const result1 = await this.postgres.instance1.query(`select 1=1;`);
      }
    }
    ```

### Using with node-postgres [`Query`](https://node-postgres.com/apis/client#clientquery)

```typescript
import { Query } from 'pg';
import { Postgres } from './file-that-exported-postgres';

@Injectable()
class SampleService {
  constructor(
    private readonly postgres: Postgres
  ) {}

  async sampleMethod() {
    const query = new Query('select $1::text as name', ['brianc']);
    const result = await this.postgres.default.query(query);

    result.on('row', (row) => {
      console.log('row!', row); // { name: 'brianc' }
    })
  }
}
```

### Enable transaction

Apply transaction on all postgres connection instances:

```typescript
import { Postgres, Transaction } from './file-that-exported-postgres';

@Injectable()
class SampleService {
  constructor(
    private readonly postgres: Postgres
  ) {}

  // Supposes we have connection instances: `instance1` and `instance2`.
  // By default it will enable transaction for both `instance1` and `instance2` if not specified.
  @Transaction()
  async sampleMethod() {
    const result = await this.postgres.instance1.query(`select 1=1;`);
  }
}
```

Apply transaction on specified postgres connection instances:

```typescript
import { Postgres, Transaction } from './file-that-exported-postgres';

@Injectable()
class SampleService {
  constructor(
    private readonly postgres: Postgres
  ) {}

  // Supposes we have connection instances: `instance1` and `instance2`.
  // It will enable transaction for `instance1` as specified.
  @Transaction(`instance1`)
  async sampleMethod() {
    const result = await this.postgres.instance1.query(`select 1=1;`);
  }
}
```

### High availability (HA)

Register postgres connection instance with multiple host.

When enabled, `instance1` will attempt to connect db with each hosts/ports in sequence until a connection is successfully established.

**Note: This is a temporary workaround and will change once `node-postgres` internally supports multiple hosts.**

```typescript
@Module({
  imports: [
    PostgresModule.register({
      connections: [
        {
          name: 'instance1',
          hosts: [
            {
              host: 'instance_1_host_1',
              port: 1
            },
            {
              host: 'instance_1_host_2',
              port: 2
            }
          ]
        }
      ]
    })
  ],
  providers: [SampleService]
})
export class SampleModule {} 
```

## License

MIT License