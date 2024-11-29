import { Injectable } from '@nestjs/common';
import { AuthzProviderClass, createJwtAuthzModule } from '../../src';

interface Payload1 {
  payloadId1: string;
}

export interface User1 {
  userId1: string;
}

@Injectable()
class JwtAuthzProvider1 extends AuthzProviderClass<Payload1, User1> {
  authenticate = (payload: Payload1) => ({
    userId1: payload.payloadId1
  });

  createPayload = (user: User1) => ({
    payloadId1: user.userId1
  });
}

export const {
  AuthzGuard: JwtAuthzGuard1,
  AuthzService: JwtAuthzService1,
  AuthzModule: JwtAuthzModule1
} = createJwtAuthzModule(JwtAuthzProvider1);
export type JwtAuthzService1 = InstanceType<typeof JwtAuthzService1>;

interface Payload2 {
  payloadId2: string;
  jwtRole2?: string;
}

export interface User2 {
  userId2: string;
  jwtRole2?: string;
}

@Injectable()
class JwtAuthzProvider2 extends AuthzProviderClass<Payload2, User2> {
  authenticate = (payload: Payload2) => ({
    userId2: payload.payloadId2,
    jwtRole2: payload.jwtRole2
  });

  createPayload = (user: User2) => ({
    payloadId2: user.userId2,
    jwtRole2: user.jwtRole2
  });

  authorize(uesr: User2, metaData?: string) {
    if (!metaData) {
      return true;
    }
    return uesr.jwtRole2 === metaData;
  }
}

export const {
  AuthzGuard: JwtAuthzGuard2,
  AuthzService: JwtAuthzService2,
  AuthzModule: JwtAuthzModule2
} = createJwtAuthzModule(JwtAuthzProvider2);
export type JwtAuthzService2 = InstanceType<typeof JwtAuthzService2>;
