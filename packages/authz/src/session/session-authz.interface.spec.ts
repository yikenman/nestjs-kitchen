import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import { type SessionAuthzModuleOptions, normalizedSessionAuthzModuleOptions } from './session-authz.interface';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Session Authz Interface', () => {
  describe('normalizedSessionAuthzModuleOptions', () => {
    it('should normalize options with empty options', () => {
      const result = normalizedSessionAuthzModuleOptions();

      expect(result.defaultOverride).toBe(false);
      expect(result.passportProperty).toBe(DEFAULT_PASSPORT_PROPERTY_VALUE);
      expect(result.skipFalsyMetadata).toBe(false);
      expect(result.defaultAllowAnonymous).toBe(false);

      expect(result.session).toBeDefined();
      expect(result.session).toMatchObject({
        resave: false,
        saveUninitialized: false
      });
    });

    it('should normalize options with empty session', () => {
      const result = normalizedSessionAuthzModuleOptions({});

      expect(result.defaultOverride).toBe(false);
      expect(result.passportProperty).toBe(DEFAULT_PASSPORT_PROPERTY_VALUE);
      expect(result.skipFalsyMetadata).toBe(false);
      expect(result.defaultAllowAnonymous).toBe(false);

      expect(result.session).toBeDefined();
      expect(result.session).toMatchObject({
        resave: false,
        saveUninitialized: false
      });
    });

    it('should override default values if provided in options', () => {
      const options: SessionAuthzModuleOptions = {
        defaultOverride: true,
        passportProperty: 'custom',
        skipFalsyMetadata: true,
        defaultAllowAnonymous: true,
        session: {
          secret: '123456'
        }
      };

      const result = normalizedSessionAuthzModuleOptions(options);
      expect(result.defaultOverride).toBe(true);
      expect(result.passportProperty).toBe('custom');
      expect(result.skipFalsyMetadata).toBe(true);
      expect(result.defaultAllowAnonymous).toBe(true);

      expect(result.session).toBeDefined();
      expect(result.session).toMatchObject({
        secret: options.session.secret,
        resave: false,
        saveUninitialized: false
      });
    });
  });
});
