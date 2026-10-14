import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  EXPRESS_PORT: Joi.number().port().default(3001),

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
});
