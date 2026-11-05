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

  it('defaults the standalone Fastify listener to port 3002', () => {
    const { error, value } = envValidationSchema.validate(
      requiredConfiguration,
    );

    expect(error).toBeUndefined();
    expect(value.FASTIFY_PORT).toBe(3002);
  });

  it('rejects an invalid Express listener port', () => {
    const { error } = envValidationSchema.validate({
      ...requiredConfiguration,
      EXPRESS_PORT: 70000,
    });

    expect(error).toBeDefined();
  });

  it('rejects an invalid Fastify listener port', () => {
    const { error } = envValidationSchema.validate({
      ...requiredConfiguration,
      FASTIFY_PORT: 70000,
    });

    expect(error).toBeDefined();
  });

  it('requires AWS region and S3 bucket to be configured together', () => {
    expect(
      envValidationSchema.validate({
        ...requiredConfiguration,
        AWS_REGION: 'us-east-1',
      }).error,
    ).toBeDefined();
    expect(
      envValidationSchema.validate({
        ...requiredConfiguration,
        AWS_REGION: 'us-east-1',
        S3_BUCKET: 'customer-platform-private-documents',
      }).error,
    ).toBeUndefined();
  });

  it('treats blank optional S3 configuration as absent', () => {
    const { error, value } = envValidationSchema.validate({
      ...requiredConfiguration,
      AWS_REGION: '',
      S3_BUCKET: '',
    });

    expect(error).toBeUndefined();
    expect(value.AWS_REGION).toBeUndefined();
    expect(value.S3_BUCKET).toBeUndefined();
  });

  it('validates advanced RAG options and requires a non-zero hybrid weight', () => {
    const defaults = envValidationSchema.validate(requiredConfiguration);
    expect(defaults.error).toBeUndefined();
    expect(defaults.value.RAG_CANDIDATE_K).toBe(20);
    expect(defaults.value.RAG_QUERY_REWRITING_ENABLED).toBe(true);

    expect(
      envValidationSchema.validate({
        ...requiredConfiguration,
        RAG_SEMANTIC_WEIGHT: 0,
        RAG_KEYWORD_WEIGHT: 0,
      }).error,
    ).toBeDefined();
    expect(
      envValidationSchema.validate({
        ...requiredConfiguration,
        RAG_CANDIDATE_K: 101,
      }).error,
    ).toBeDefined();
  });
});
