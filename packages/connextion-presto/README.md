# @nestjs-kitchen/connextion-presto

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fconnextion-presto)
](https://www.npmjs.com/package/@nestjs-kitchen/connextion-presto)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fconnextion-presto)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/connextion-presto)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A flexible module to provide [presto-client](https://www.npmjs.com/package/presto-client) interface in NextJS.

---

## Install

```bash
$ npm install --save @nestjs-kitchen/connextion @nestjs-kitchen/connextion-presto presto-client @types/presto-client
```

## Usage

### Apply `PrestoModule`

1. Export module, service & decorator. 

    ```typescript
    export const { Presto, PrestoModule } = definePresto();
    export type Presto = InstanceType<typeof Presto>;
    ```

2. Register presto connection instance with options.

    ```typescript
    @Module({
      imports: [
        // By default it will register a connection instance called `default`.
        PrestoModule.register({
          // default's options...
        })
      ],
      providers: [SampleService]
    })
    export class SampleModule {} 
    ```

3. Inject `Presto` service.

    ```typescript
    import { Presto } from './file-that-exported-presto';
    
    @Injectable()
    class SampleService {
      constructor(
        private readonly presto: Presto,
      ) {}
    
      async sampleMethod() {
        const result1 = await this.presto.default.execute({ query: `select 1=1;` });
      }
    }
    ```

### Register multiple presto instances

1. Define presto connection instance names and export module, service & decorator. 

    e.g.: `instance_1`,`instance_2`.

    ```typescript
    export const { Presto, PrestoModule } = definePresto<'instance_1' | 'instance_2'>();
    export type Presto = InstanceType<typeof Presto>;
    ```

2. Register presto connection instances with options.

    ```typescript
    @Module({
      imports: [
        PrestoModule.register({
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

3. Inject `Presto` service.

    ```typescript
    import { Presto } from './file-that-exported-presto';
    
    @Injectable()
    class SampleService {
      constructor(
        private readonly presto: Presto,
      ) {}
    
      async sampleMethod() {
        const result1 = await this.presto.instance1.execute({ query: `select 1=1;` });
      }
    }
    ```


## License

MIT License