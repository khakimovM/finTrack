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
