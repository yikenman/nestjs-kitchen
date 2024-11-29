import { Packr } from 'msgpackr';

const packr = new Packr();

export const encodeMsgpackrString = <T extends object>(payload: T) => {
  return Buffer.from(packr.pack(payload)).toString('base64');
};

export const decodeMsgpackrString = <T extends object>(msgpackrString: string) => {
  return packr.unpack(Buffer.from(msgpackrString, 'base64')) as T;
};
