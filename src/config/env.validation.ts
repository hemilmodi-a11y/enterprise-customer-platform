import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  EXPRESS_PORT: Joi.number().port().default(3001),

  FASTIFY_PORT: Joi.number().port().default(3002),

  CORS_ORIGINS: Joi.string().allow('').default(''),

  RATE_LIMIT_TTL_SECONDS: Joi.number().integer().min(1).max(3600).default(60),

  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(120),

  AI_PROVIDER: Joi.string().valid('openai').default('openai'),

  AI_API_KEY: Joi.string().min(1).empty(''),

  AI_MODEL: Joi.string().min(1).default('gpt-4o-mini'),

  AI_TEMPERATURE: Joi.number().min(0).max(1).default(0.2),

  AI_MAX_TOKENS: Joi.number().integer().min(1).max(2048).default(512),

  AI_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(15000),

  AI_RETRIEVAL_LIMIT: Joi.number().integer().min(1).max(10).default(5),

  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),

  SWAGGER_ENABLED: Joi.boolean().default(true),

  CACHE_ENABLED: Joi.boolean().default(true),

  CACHE_REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),

  CACHE_SERVICE_LIST_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(3600)
    .default(60),

  CACHE_SERVICE_DETAIL_TTL_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(3600)
    .default(120),

  AWS_REGION: Joi.string().min(1).empty(''),

  S3_BUCKET: Joi.string().min(3).max(63).empty(''),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),

  JWT_SECRET: Joi.string().required(),

  DB_HOST: Joi.string().required(),

  DB_PORT: Joi.number().port().default(3306),

  DB_USERNAME: Joi.string().required(),

  DB_PASSWORD: Joi.string().required(),

  DB_NAME: Joi.string().required(),

  MONGO_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
})
  .with('AWS_REGION', 'S3_BUCKET')
  .with('S3_BUCKET', 'AWS_REGION');
