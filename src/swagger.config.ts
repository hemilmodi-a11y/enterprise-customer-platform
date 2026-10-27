import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_UI_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Enterprise Customer Platform API')
    .setDescription(
      [
        'REST API for customer, service, service-request, document upload, authentication, notification, analytics, and health workflows.',
        'Business routes use the URI version prefix /api/v1. Protected operations require a bearer JWT and may additionally require a documented role.',
        'Errors from the primary NestJS API use a request-correlated JSON envelope; unexpected server errors do not expose internal details.',
      ].join('\n\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the access token returned by the login endpoint.',
      },
      'bearer',
    )
    .addTag('auth', 'Registration, login, and token/password actions')
    .addTag('users', 'Administrative user lookup')
    .addTag('customers', 'Customer profiles and accounts')
    .addTag('services', 'Service catalog')
    .addTag('requests', 'Service requests and assignment')
    .addTag('agents', 'Agent request workload queries')
    .addTag('notifications', 'User notifications')
    .addTag('analytics', 'Reporting and analytics')
    .addTag('health', 'Container liveness and readiness probes')
    .build();

  return SwaggerModule.createDocument(app, config);
}

export function configureSwagger(app: INestApplication): OpenAPIObject {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
    },
  });
  return document;
}
