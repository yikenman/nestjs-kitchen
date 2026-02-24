import { MAX_LENGTH, TRANSACTION_META } from './constants';
import { DuckDBError } from './errors';

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
    const firstLine = `Executing Presto command\n`;
    defaultLogger(firstLine + printTable(data));
  };
};

export const noop = (..._: unknown[]) => {};

export const isUndefinedOrNull = (val: any): val is undefined | null => {
  return val === undefined || val === null;
};

export const removeEmptyValue = (obj?: { [key: string]: string | undefined }): Record<string, string> | undefined => {
  if (!obj) {
    return undefined;
  }

  let result: Record<string, string> | undefined = undefined;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !isUndefinedOrNull(obj[key])) {
      if (!result) {
        result = {};
      }
      result[key] = obj[key];
    }
  }

  return result;
};

export const createProxy = <T extends object>(obj: T, asyncMethods?: Set<string>): T => {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      try {
        const value = Reflect.get(target, prop, receiver);

        if (typeof value === 'function') {
          if (asyncMethods && asyncMethods.has(prop as string)) {
            return async function (...args: unknown[]) {
              try {
                return await value.apply(receiver, args);
              } catch (error) {
                throw new DuckDBError(error, error);
              }
            };
          }
          return function (...args: unknown[]) {
            try {
              return value.apply(receiver, args);
            } catch (error) {
              throw new DuckDBError(error, error);
            }
          };
        }

        return value;
      } catch (error) {
        throw new DuckDBError(error, error);
      }
    }
  });
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
