import { type PrivateKey, type PublicKey, type Secret, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import { type AuthzModuleBaseOptions, normalizedArray, normalizedObject } from '../utils';
import type { JwtFromRequestFunction } from './extract-jwt';

export type JwtOptions = Omit<VerifyOptions, 'algorithms' | 'audience' | 'issuer'> &
  SignOptions & {
    /**
     * Function that accepts a request as the only parameter and returns either the JWT as a string or null.
     *
     * Same as `passport-jwt` [jwtFromRequest option](https://www.passportjs.org/packages/passport-jwt/#configure-strategy).
     */
    jwtFromRequest: JwtFromRequestFunction | JwtFromRequestFunction[];
    /**
     * Secret string used for HMAC algorithms.
     */
    secret?: Secret;
    /**
     * PEM-encoded private key used for RSA and ECDSA algorithms.
     */
    privateKey?: PrivateKey;
    /**
     * PEM-encoded public key corresponding to the `privateKey` used for RSA and ECDSA algorithms.
     */
    publicKey?: PublicKey;
  };

export type JwtAuthzModuleOptions = Partial<AuthzModuleBaseOptions> & {
  /**
   * JWT sign & verify options.
   *
   * This combines `jsonwebtoken` [sign options](https://www.npmjs.com/package/jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback)
   * and [verify options](https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback).
   */
  jwt: JwtOptions;
  /**
   * Refresh token sign & verify options.
   *
   * This combines `jsonwebtoken` [sign options](https://www.npmjs.com/package/jsonwebtoken#jwtsignpayload-secretorprivatekey-options-callback)
   * and [verify options](https://www.npmjs.com/package/jsonwebtoken#jwtverifytoken-secretorpublickey-options-callback).
   */
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
