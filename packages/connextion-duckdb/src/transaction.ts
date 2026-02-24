import type { DuckDBConnection } from '@duckdb/node-api';
import { Inject } from '@nestjs/common';
import { defineConnextionBuilder } from '@nestjs-kitchen/connextion';
import { ALS, GET_CON } from './constants';
import type { DuckDBInstance } from './duckdb.instance';
import { DuckDBError } from './errors';
import {
  copyMethodMetadata,
  getTransactionMetdata,
  noop,
  normalizeStrings,
  plainPromise,
  setTransactionMetdata
} from './utils';

type DuckDB = ReturnType<ReturnType<typeof defineConnextionBuilder<'DuckDB', DuckDBInstance>>>['DuckDB'];

export const createTransaction = <T extends string>(duckDB: DuckDB) => {
  const duckdbPropName = Symbol('duckdb');

  return (...rest: T[]) => {
    const injectDuckDB = Inject(duckDB);

    return (target: any, _propertyKey: string, propertyDescriptor: PropertyDescriptor) => {
      // This is equivalent to property-based injection in the class.
      // It will append a new injection to the class where the target method is located.
      // Ref: https://stackoverflow.com/questions/52106406/in-nest-js-how-to-get-a-service-instance-inside-a-decorator
      injectDuckDB(target, duckdbPropName);

      const originalMethod = propertyDescriptor.value;

      if (getTransactionMetdata(originalMethod)) {
        throw new DuckDBError('Cannot reapply the same transaction decorator multiple times.');
      }
      setTransactionMetdata(originalMethod);

      propertyDescriptor.value = async function (...args: any[]) {
        const that = this;
        const duckDB: InstanceType<DuckDB> = that[duckdbPropName];

        // Enables transaction by default for all instances.
        const keys = rest.length ? rest : Object.keys(duckDB.instanceTokens);

        const validNames: string[] = [];
        const invalidNames: string[] = [];
        normalizeStrings(keys).forEach((name) => {
          if (duckDB.instanceTokens[name]) {
            validNames.push(name);
          } else {
            invalidNames.push(name);
          }
        });

        if (invalidNames.length) {
          throw new DuckDBError(`Invalid keys: ${invalidNames.join(', ')}`);
        }

        const list = validNames.map((name) => {
          return {
            name,
            store: {
              connection: duckDB[name][GET_CON](),
              queries: []
            },
            als: duckDB[name][ALS],
            inited: false
          };
        });

        const initCons = async () => {
          for (const ele of list) {
            await ele.store.connection;
            ele.inited = true;
          }
        };

        const runWithCons = async (fn: (con: DuckDBConnection) => Promise<void>) => {
          for (const ele of list) {
            if (ele.inited) {
              const con = await ele.store.connection;
              await fn(con);
            }
          }
        };

        const releaseCons = async (err?: any) => runWithCons(async (con: DuckDBConnection) => con.disconnectSync());

        // Ensure all cons are available.
        const [_, initErr] = await plainPromise(initCons());
        if (initErr) {
          // Error is not caused by the available cons. No need to pass the error.
          await releaseCons();
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
                await runWithCons(async (con) => {
                  await con.run('BEGIN TRANSACTION;');
                });
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
            await runWithCons(async (con) => {
              await con.run(err ? 'ROLLBACK;' : 'COMMIT;');
            });

            if (err) {
              throw err;
            }
            return result;
          })()
        );

        // Release all cons.
        await releaseCons(err);

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
