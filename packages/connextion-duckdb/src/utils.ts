import { MAX_LENGTH } from './constants';
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

export const removeEmptyValue = (obj?: {
  [key: string]: string | undefined;
}): Record<string, string> | undefined => {
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
