import { defineConnextionBuilder } from '@nestjs-kitchen/connextion';
import { Inject } from '@nestjs/common';
import { ALS, GET_CLIENT } from './constants';
import { PostgresError } from './errors';
import type { PostgresInstance } from './postgres.instance';
import {
  copyMethodMetadata,
  getTransactionMetdata,
  normalizeStrings,
  plainPromise,
  setTransactionMetdata
} from './utils';

type Postgres = ReturnType<ReturnType<typeof defineConnextionBuilder<'Postgres', PostgresInstance>>>['Postgres'];

export const createTransaction = <T extends string>(Postgres: Postgres) => {
  const postgresPropName = Symbol('postgres');

  return (...rest: T[]) => {
    const injectPostgres = Inject(Postgres);

    return (target: any, _propertyKey: string, propertyDescriptor: PropertyDescriptor) => {
      // This is equivalent to property-based injection in the class.
      // It will append a new injection to the class where the target method is located.
      // Ref: https://stackoverflow.com/questions/52106406/in-nest-js-how-to-get-a-service-instance-inside-a-decorator
      injectPostgres(target, postgresPropName);

      const originalMethod = propertyDescriptor.value;

      if (getTransactionMetdata(originalMethod)) {
        throw new PostgresError('Cannot reapply the same transaction decorator multiple times.');
      }
      setTransactionMetdata(originalMethod);

      propertyDescriptor.value = async function (...args: any[]) {
        const that = this;
        const postgres: InstanceType<Postgres> = that[postgresPropName];

        // Enables transaction by default for all instances.
        const keys = rest.length ? rest : Object.keys(postgres.instanceTokens);

        const validNames: string[] = [];
        const invalidNames: string[] = [];
        normalizeStrings(keys).forEach((name) => {
          if (postgres.instanceTokens[name]) {
            validNames.push(name);
          } else {
            invalidNames.push(name);
          }
        });

        if (invalidNames.length) {
          throw new PostgresError(`Invalid keys: ${invalidNames.join(', ')}`);
        }

        const list = validNames.map((name) => {
          return {
            name,
            store: {
              client: postgres[name][GET_CLIENT](),
              queries: []
            },
            als: postgres[name][ALS],
            inited: false
          };
        });

        const initClients = async () => {
          for (const ele of list) {
            await ele.store.client;
            ele.inited = true;
          }
        };

        const runWithClients = async (fn: (client: any) => Promise<void>) => {
          for (const ele of list) {
            if (ele.inited) {
              const client = await ele.store.client;
              await fn(client);
            }
          }
        };

        const releaseClients = async (err?: any) => runWithClients((client) => client.release(err));

        // Ensure all clients are available.
        const [_, initErr] = await plainPromise(initClients());
        if (initErr) {
          // Error is not caused by the available clients. No need to pass the error.
          await releaseClients();
          throw initErr;
        }

        const executeQueries = list.reduce(
          (next, ele) => () => ele.als.run(ele.store, next),
          () => originalMethod.apply(that, args)
        );

        const [result, err] = await plainPromise(
          (async () => {
            const [result, err] = await plainPromise(
              // Start transaction and execute queries.
              (async () => {
                await runWithClients((client) => client.query('BEGIN'));
                const result = await executeQueries();
                // Collect query errors.
                const queryResults = await Promise.all(list.flatMap((c) => c.store.queries));
                const queryFailures = queryResults.filter((res) => res !== true);
                if (queryFailures.length) {
                  throw queryFailures[0];
                }
                return result;
              })()
            );
            // End transaction with thrown/query error.
            await runWithClients((client) => client.query(err ? 'ROLLBACK' : 'COMMIT'));

            if (err) {
              throw err;
            }
            return result;
          })()
        );

        // Release all clients.
        await releaseClients(err);

        // Resume function call.
        if (err) {
          throw err;
        }
        return result;
      };

      // Compatible with NestJS decorators.
      copyMethodMetadata(originalMethod, propertyDescriptor.value);

      return propertyDescriptor;
    };
  };
};
