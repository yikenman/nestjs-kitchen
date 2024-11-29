import { Injectable } from '@nestjs/common';
import { AuthzProviderClass, cereateSessionAuthzModule } from '../../src';

interface Payload3 {
  payloadId3: string;
}

export interface User3 {
  userId3: string;
}

@Injectable()
class SessionAuthzProvider3 extends AuthzProviderClass<Payload3, User3> {
  authenticate = (payload: Payload3) => ({
    userId3: payload.payloadId3
  });

  createPayload = (user: User3) => ({
    payloadId3: user.userId3
  });
}

export const {
  AuthzGuard: SessionAuthzGuard3,
  AuthzService: SessionAuthzService3,
  AuthzModule: SessionAuthzModule3
} = cereateSessionAuthzModule(SessionAuthzProvider3);
export type SessionAuthzService3 = InstanceType<typeof SessionAuthzService3>;

interface Payload4 {
  payloadId4: string;
  sessionRole4?: string;
}

export interface User4 {
  userId4: string;
  sessionRole4?: string;
}

@Injectable()
class SessionAuthzProvider4 extends AuthzProviderClass<Payload4, User4> {
  authenticate = (payload: Payload4) => ({
    userId4: payload.payloadId4,
    sessionRole4: payload.sessionRole4
  });

  createPayload = (user: User4) => ({
    payloadId4: user.userId4,
    sessionRole4: user.sessionRole4
  });

  authorize(uesr: User4, metaData?: string) {
    if (!metaData) {
      return true;
    }
    return uesr.sessionRole4 === metaData;
  }
}

export const {
  AuthzGuard: SessionAuthzGuard4,
  AuthzService: SessionAuthzService4,
  AuthzModule: SessionAuthzModule4
} = cereateSessionAuthzModule(SessionAuthzProvider4);
export type SessionAuthzService4 = InstanceType<typeof SessionAuthzService4>;
