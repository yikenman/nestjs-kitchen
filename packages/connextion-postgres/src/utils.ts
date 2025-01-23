import type { EventEmitter } from 'node:stream';
import dayjs from 'dayjs';
import { type PoolClient, type Submittable } from 'pg';
import { DATE_FORMAT, MAX_LENGTH, TRANSACTION_META } from './constants';

export const isSubmittable = (val: any): val is Submittable => {
  return val && typeof val.submit === 'function';
};

export const isObject = (val: any): val is object => {
  return Object.prototype.toString.call(val) === '[object Object]';
};

export const normalizeStrings = (strs?: string[]) => {
  if (!strs) {
    return [];
  }
  return Array.from(new Set(strs.filter(Boolean).map((ele) => ele.trim())));
};

export const plainPromise = async <T>(promise: Promise<T> | T): Promise<[T, undefined] | [undefined, any]> => {
  let result: T | undefined = undefined;
  let err: unknown = undefined;

  try {
    result = await promise;
  } catch (error) {
    err = error;
  }

  return [result, err] as any;
};

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) {
    return str;
  }

  const truncatedLength = maxLength - 3;
  if (truncatedLength <= 0) {
    return '...';
  }

  return str.slice(0, truncatedLength) + '...';
};

export const printTable = (logData: Record<string, any>): string => {
  const maxKeyLength = MAX_LENGTH / 3;
  const maxValueLength = MAX_LENGTH;
  const separatorTop = '─'.repeat(maxKeyLength + 2) + '┬' + '─'.repeat(maxValueLength + 2);
  const separatorBottom = '─'.repeat(maxKeyLength + 2) + '┴' + '─'.repeat(maxValueLength + 2);

  const lines = [
    `┌${separatorTop}┐`,
    ...Object.entries(logData)
      .filter(([_, value]) => value)
      .map(
        ([key, value]) =>
          `│ ${key.padEnd(maxKeyLength)} │ ${truncateString(String(value), MAX_LENGTH).padEnd(maxValueLength)} │`
      ),
    `└${separatorBottom}┘`
  ];

  return lines.join('\n');
};

export const getCurrentDateStr = () => {
  return dayjs().format(DATE_FORMAT);
};

export const formatArray = (arr?: any) => {
  return Array.isArray(arr) ? `[${arr.map(String).join(', ')}]` : 'null';
};

export const extraceQueryTextAndValues = (...rest: any[]): [text: string, values: any[]] => {
  const [arg0, arg1] = rest;

  if (arg0 && (isSubmittable(arg0) || isObject(arg0))) {
    return [(arg0 as any).text, arg1 ?? (arg0 as any).values];
  }

  return [arg0, arg1];
};

export const createDebugLogger = (
  defaultLogger: (...rest: any) => void,
  customFormater?: Boolean | ((data: Record<any, any>) => void)
) => {
  if (typeof customFormater === 'function') {
    return (data: Record<any, any>) => {
      defaultLogger(customFormater(data));
    };
  }
  return (data: Record<any, any>) => {
    const firstLine = `Executing Postgres command\n`;
    defaultLogger(firstLine + printTable(data));
  };
};

export const debugFactroy = (name: string, queryId: string, logger: (data: Record<any, any>) => void) => {
  return {
    pool: {
      connect: <T extends () => Promise<PoolClient>>(callback: T) => {
        return async (): Promise<PoolClient> => {
          const startOn = getCurrentDateStr();
          let err: any = undefined;

          try {
            return await callback();
          } catch (error) {
            err = error;
            throw err;
          } finally {
            logger({
              Instance: name,
              Client: queryId,
              Type: 'Request new client',
              'Started On': startOn,
              'Ended On': getCurrentDateStr(),
              Status: err ? 'Failed' : 'Successful',
              Error: err
            });
          }
        };
      }
    },
    client: {
      query: <T extends (...rest: unknown[]) => Promise<any>>(callback: T) => {
        return async (...rest: Parameters<T>) => {
          const [text, values] = extraceQueryTextAndValues(...rest);
          const submittable = isSubmittable(rest[0]);
          const startOn = getCurrentDateStr();
          let err: any = undefined;

          if (submittable) {
            (rest[0] as EventEmitter).on('end', () => {
              logger({
                Instance: name,
                Client: queryId,
                Type: 'Submittable',
                Text: text,
                Values: formatArray(values),
                'Started On': startOn,
                'Ended On': getCurrentDateStr(),
                Status: 'Successful'
              });
            });
            (rest[0] as EventEmitter).on('error', (err) => {
              logger({
                Instance: name,
                Client: queryId,
                Type: 'Submittable',
                Text: text,
                Values: formatArray(values),
                'Started On': startOn,
                'Ended On': getCurrentDateStr(),
                Status: 'Failed',
                Error: err
              });
            });
          }

          try {
            return await callback(...rest);
          } catch (error) {
            err = error;
            throw err;
          } finally {
            if (!submittable) {
              logger({
                Instance: name,
                Client: queryId,
                Type: 'Query',
                Text: text,
                Values: formatArray(values),
                'Started On': startOn,
                'Ended On': getCurrentDateStr(),
                Status: err ? 'Failed' : 'Successful',
                Error: err
              });
            }
          }
        };
      },
      release: <T extends (...rest: unknown[]) => void>(callback: T) => {
        return (...rest: Parameters<T>) => {
          const startOn = getCurrentDateStr();
          let err: any = undefined;

          try {
            return callback(...rest);
          } catch (error) {
            err = error;
            throw err;
          } finally {
            logger({
              Instance: name,
              Client: queryId,
              Type: 'Release client',
              'Started On': startOn,
              'Ended On': getCurrentDateStr(),
              Status: err ? 'Failed' : 'Successful',
              Error: err
            });
          }
        };
      }
    }
  };
};

// Ref: https://github.com/Papooch/nestjs-cls/blob/main/packages/core/src/utils/copy-method-metadata.ts#L10
export const copyMethodMetadata = (from: any, to: any) => {
  const metadataKeys = Reflect.getMetadataKeys(from);
  metadataKeys.map((key) => {
    const value = Reflect.getMetadata(key, from);
    Reflect.defineMetadata(key, value, to);
  });
};

export const getTransactionMetdata = (target: any) => {
  return Reflect.getMetadata(TRANSACTION_META, target);
};

export const setTransactionMetdata = (target: any) => {
  return Reflect.defineMetadata(TRANSACTION_META, true, target);
};

export const withResolvers = <T>() => {
  let resolve: PromiseWithResolvers<T>['resolve'];
  let reject: PromiseWithResolvers<T>['reject'];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
};
