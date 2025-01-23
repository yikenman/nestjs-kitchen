import dayjs from 'dayjs';
import type { Column } from 'presto-client';
import { DATE_FORMAT, MAX_LENGTH } from './constants';

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

export const buildDataRows = <T>(columns: Column[], data: unknown[][]) => {
  return data.map((item) => {
    const row = {};
    for (const [index, column] of columns.entries()) {
      row[column.name] = item[index];
    }
    return row as T;
  });
};

export const noop = (..._: unknown[]) => {};

export const withResolvers = <T>() => {
  let resolve: PromiseWithResolvers<T>['resolve'];
  let reject: PromiseWithResolvers<T>['reject'];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
};
