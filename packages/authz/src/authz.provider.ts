import type { Request } from 'express';

/**
 * Abstract base class for implementing custom authorization logic.
 *
 * @template Payload - The type representing the payload used for authentication.
 * @template User - The type representing the user entity involved in authentication and authorization.
 */
export abstract class AuthzProviderClass<Payload, User> {
  /**
   * Creates a payload from the given user.
   *
   * This method is intended to transform a user entity into a payload, which can be used
   * for token generation or other authentication mechanisms.
   *
   * @param {User} user - The user entity to create the payload for.
   * @returns {Payload | Promise<Payload>} A payload derived from the user entity,
   * or a promise resolving to the payload.
   */
  abstract createPayload(user: User): Payload | Promise<Payload>;

  /**
   * Authenticates a given payload to retrieve a user.
   *
   * This method is used to validate a payload and map it back to a user entity,
   * typically as part of a token-based authentication workflow.
   *
   * @param {Payload} payload - The payload to authenticate.
   * @returns {User | Promise<User>} The authenticated user, or a promise resolving to the user.
   */
  abstract authenticate(payload: Payload, req?: Request): User | Promise<User>;

  /**
   * (**Optional**: Implement this method only if authorization is required.)
   *
   * Authorizes a user based on the provided metadata.
   *
   * This method checks if the given user is authorized to perform a specific action based on
   * the provided metadata. If implemented, this method enables the authorization check; otherwise,
   * only authentication will be performed.
   *
   * @param {User} _user - The user entity that needs to be authorized.
   * @param {unknown} [_metaData] - Optional metadata that can influence the authorization decision.
   * @returns {boolean | Promise<boolean>} `true` if the user is authorized, `false` otherwise,
   * or a promise that resolves to the authorization result.
   */
  authorize(_user: User, _metaData?: unknown): boolean | Promise<boolean> {
    return true; // Default implementation always returns true.
  }
}
