import { describe, expect, it } from '@jest/globals';

import { envValidationSchema } from './env.validation';

describe('environment validation', () => {
  const requiredConfiguration = {
    JWT_SECRET: 'test-secret',
    DB_HOST: 'localhost',
    DB_USERNAME: 'test-user',
    DB_PASSWORD: 'test-password',
    DB_NAME: 'test_database',
    MONGO_URI: 'mongodb://localhost:27017/test_database',
  };

  it('requires a valid MongoDB URI', () => {
    const valid = envValidationSchema.validate(requiredConfiguration);
    expect(valid.error).toBeUndefined();

    const missing = envValidationSchema.validate({
      ...requiredConfiguration,
      MONGO_URI: undefined,
    });
    expect(missing.error).toBeDefined();

    const invalid = envValidationSchema.validate({
      ...requiredConfiguration,
      MONGO_URI: 'not-a-mongo-uri',
    });
    expect(invalid.error).toBeDefined();
  });

  it('defaults the standalone Express listener to port 3001', () => {
    const { error, value } = envValidationSchema.validate(
      requiredConfiguration,
    );

    expect(error).toBeUndefined();
    expect(value.EXPRESS_PORT).toBe(3001);
  });

  it('rejects an invalid Express listener port', () => {
    const { error } = envValidationSchema.validate({
      ...requiredConfiguration,
      EXPRESS_PORT: 70000,
    });

    expect(error).toBeDefined();
  });
});
