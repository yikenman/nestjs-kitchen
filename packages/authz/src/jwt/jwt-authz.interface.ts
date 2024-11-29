import { type PrivateKey, type PublicKey, type Secret, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import { type AuthzModuleBaseOptions, normalizedArray, normalizedObject } from '../utils';
import type { JwtFromRequestFunction } from './extract-jwt';

export type JwtOptions = Omit<VerifyOptions, 'algorithms' | 'audience' | 'issuer'> &
  SignOptions & {
    jwtFromRequest: JwtFromRequestFunction | JwtFromRequestFunction[];
    secret?: Secret;
    privateKey?: PrivateKey;
    publicKey?: PublicKey;
  };

export type JwtAuthzModuleOptions = Partial<AuthzModuleBaseOptions> & {
  jwt: JwtOptions;
  refresh?: JwtOptions;
};

const normalizedJwtOptions = (jwtOptions?: JwtAuthzModuleOptions['jwt']) => {
  if (!jwtOptions) {
    return undefined;
  }
  const {
    jwtFromRequest,
    algorithm,
    audience,
    clockTimestamp,
    clockTolerance,
    complete,
    ignoreExpiration,
    ignoreNotBefore,
    issuer,
    jwtid,
    maxAge,
    nonce,
    privateKey,
    publicKey,
    secret,
    subject,
    allowInsecureKeySizes,
    encoding,
    expiresIn,
    header,
    keyid,
    mutatePayload,
    noTimestamp,
    notBefore,
    allowInvalidAsymmetricKeyTypes
  } = jwtOptions;

  const formattedJwtFromRequest = normalizedArray(jwtFromRequest);
  const algorithms = normalizedArray(algorithm);

  const sign: SignOptions = {
    algorithm: algorithms?.[0],
    audience,
    issuer,
    jwtid,
    subject,
    allowInsecureKeySizes,
    encoding,
    expiresIn,
    header,
    keyid,
    mutatePayload,
    notBefore,
    noTimestamp,
    allowInvalidAsymmetricKeyTypes
  };

  const verify: VerifyOptions = {
    algorithms,
    audience,
    clockTimestamp,
    clockTolerance,
    complete,
    ignoreExpiration,
    ignoreNotBefore,
    issuer,
    jwtid,
    maxAge,
    nonce,
    subject,
    allowInvalidAsymmetricKeyTypes
  };

  let secretOrPrivateKey: Secret | PrivateKey | undefined = secret;
  let secretOrPublicKey: Secret | PublicKey | undefined = secret;
  if (privateKey || publicKey) {
    secretOrPrivateKey = privateKey;
    secretOrPublicKey = publicKey;
    if (secret) {
      console.warn(`Both secret and privateKey/publicKey have been set, only privateKey/publicKey will take effect.`);
    }
  }

  return {
    secretOrPrivateKey: secretOrPrivateKey ?? null,
    secretOrPublicKey: secretOrPublicKey ?? null,
    jwtFromRequest: formattedJwtFromRequest ?? [],
    sign: normalizedObject(sign) ?? {},
    verify: normalizedObject(verify) ?? {}
  };
};

export const normalizedJwtAuthzModuleOptions = (options: JwtAuthzModuleOptions) => {
  return {
    defaultOverride: options?.defaultOverride || false,
    passportProperty: options?.passportProperty || DEFAULT_PASSPORT_PROPERTY_VALUE,
    skipFalsyMetadata: options?.skipFalsyMetadata || false,
    defaultAllowAnonymous: options.defaultAllowAnonymous || false,
    jwt: normalizedJwtOptions(options?.jwt)!,
    refresh: normalizedJwtOptions(options?.refresh)
  };
};

export type JwtAuthzOptions = ReturnType<typeof normalizedJwtAuthzModuleOptions>;

export interface RefreshPayload {
  data: string;
}
