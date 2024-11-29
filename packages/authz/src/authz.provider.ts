export abstract class AuthzProviderClass<Payload, User> {
  abstract createPayload(user: User): Payload | Promise<Payload>;
  abstract authenticate(payload: Payload): User | Promise<User>;

  authorize(_uesr: User, _metaData?: unknown): boolean | Promise<boolean> {
    return true;
  }
}
