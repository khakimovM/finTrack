import { validateEnv } from './env.validation';

describe('env.validation', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://fintrack:fintrack@localhost:5432/fintrack',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a_very_long_secret_that_is_at_least_32_characters_long',
    JWT_REFRESH_SECRET: 'another_very_long_secret_that_is_at_least_32_chars',
  };

  it('should validate and parse valid environment variables', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(parsed.PORT).toBe(5000);
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('should throw when DATABASE_URL is missing', () => {
    const invalid = { ...validEnv };
    delete (invalid as Record<string, unknown>).DATABASE_URL;

    expect(() => validateEnv(invalid)).toThrow(/DATABASE_URL is required/);
  });

  it('should throw when JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    const invalid = { ...validEnv, JWT_ACCESS_SECRET: 'short_secret' };

    expect(() => validateEnv(invalid)).toThrow(/at least 32 characters/);
  });
});

describe('env.validation edge cases', () => {
  const base = {
    DATABASE_URL: 'postgresql://fintrack:fintrack@localhost:5432/fintrack',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a_very_long_secret_that_is_at_least_32_characters_long',
    JWT_REFRESH_SECRET: 'another_very_long_secret_that_is_at_least_32_chars',
  };

  it('treats empty values as unset so defaults apply', () => {
    const parsed = validateEnv({ ...base, SWAGGER_ENABLED: '', LOG_LEVEL: '', TRUST_PROXY: '' });
    expect(parsed.SWAGGER_ENABLED).toBeUndefined();
    expect(parsed.LOG_LEVEL).toBeUndefined();
    expect(parsed.TRUST_PROXY).toBe(1);
  });

  it('parses boolean flags without treating "false" as true', () => {
    expect(validateEnv({ ...base, SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(false);
    expect(validateEnv({ ...base, SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED).toBe(true);
  });

  it('parses TRUST_PROXY as a hop count or boolean', () => {
    expect(validateEnv({ ...base, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(validateEnv({ ...base, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
  });

  it('rejects an unknown APP_TIMEZONE', () => {
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'Mars/Olympus' })).toThrow(/APP_TIMEZONE/);
  });
});
