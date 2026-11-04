import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';

import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { RequestLoggingMiddleware } from '../src/common/middleware/request-logging.middleware';
import { NotificationOutbox } from '../src/notifications/notification-outbox.entity';
import { CatalogService } from '../src/services/catalog-service.entity';
import { Role } from '../src/roles/role.entity';
import { UserRole } from '../src/roles/user-role.entity';
import { User } from '../src/users/user.entity';
import { LlmProviderService } from '../src/ai/llm-provider.service';
import { AppModule } from './../src/app.module';

describe('Enterprise Customer Platform database-backed workflow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let agentToken: string;
  let customerToken: string;
  let agentId: number;
  const testPassword = 'E2eValidationPassword123';
  const suffix = randomUUID();
  const adminEmail = `e2e-admin-${suffix}@example.test`;
  const agentEmail = `e2e-agent-${suffix}@example.test`;
  const customerEmail = `e2e-ai-customer-${suffix}@example.test`;
  const mockedLlmProvider = {
    generateAnswer: jest
      .fn()
      .mockResolvedValue('Follow the published troubleshooting instructions.'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmProviderService)
      .useValue(mockedLlmProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    const requestLoggingMiddleware = new RequestLoggingMiddleware();
    app.use(requestLoggingMiddleware.use.bind(requestLoggingMiddleware));
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    const roles = dataSource.getRepository(Role);
    const roleByName = new Map<string, Role>();
    for (const name of ['Admin', 'Customer', 'SupportAgent']) {
      let role = await roles.findOne({ where: { name } });
      if (!role) {
        role = await roles.save(roles.create({ name, description: null }));
      }
      roleByName.set(name, role);
    }
    const adminRole = roleByName.get('Admin');
    const supportAgentRole = roleByName.get('SupportAgent');
    const customerRole = roleByName.get('Customer');
    if (!adminRole || !supportAgentRole || !customerRole) {
      throw new Error('E2E authorization roles were not created');
    }

    const users = dataSource.getRepository(User);
    const userRoles = dataSource.getRepository(UserRole);
    const passwordHash = await bcrypt.hash(testPassword, 4);
    const admin = await users.save(
      users.create({
        email: adminEmail,
        passwordHash,
        firstName: 'E2E',
        lastName: 'Administrator',
        isActive: true,
        isAvailable: true,
      }),
    );
    await userRoles.save(userRoles.create({ user: admin, role: adminRole }));

    const agent = await users.save(
      users.create({
        email: agentEmail,
        passwordHash,
        firstName: 'E2E',
        lastName: 'Agent',
        isActive: true,
        isAvailable: true,
        supportCategories: 'Support',
      }),
    );
    agentId = agent.id;
    await userRoles.save(
      userRoles.create({ user: agent, role: supportAgentRole }),
    );

    const customer = await users.save(
      users.create({
        email: customerEmail,
        passwordHash,
        firstName: 'E2E',
        lastName: 'AI Customer',
        isActive: true,
        isAvailable: true,
      }),
    );
    await userRoles.save(
      userRoles.create({ user: customer, role: customerRole }),
    );

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: testPassword })
      .expect(200);
    adminToken = login.body.accessToken as string;
    const agentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: agentEmail, password: testPassword })
      .expect(200);
    agentToken = agentLogin.body.accessToken as string;
    const customerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: testPassword })
      .expect(200);
    customerToken = customerLogin.body.accessToken as string;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('covers authentication, RBAC, customer/service APIs, request workflow, and SQL persistence', async () => {
    await request(app.getHttpServer()).get('/api/v1/customers').expect(401);

    const customerList = await request(app.getHttpServer())
      .get('/api/v1/customers?page=1&limit=10')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(customerList.body).toMatchObject({
      page: 1,
      limit: 10,
    });

    const createdService = await request(app.getHttpServer())
      .post('/api/v1/services')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: `E2E Support ${suffix}`,
        description: 'Service created for the database-backed e2e workflow.',
        category: 'Support',
        slaMinutes: 240,
      })
      .expect(201);
    const serviceId = createdService.body.id as number;

    const createdCustomer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: `e2e-customer-${suffix}@example.test`,
        password: testPassword,
        firstName: 'E2E',
        lastName: 'Customer',
        companyName: 'Validation Tenant',
      })
      .expect(201);
    const customerId = createdCustomer.body.id as number;
    const customerEmail = `e2e-customer-${suffix}@example.test`;

    const customerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: testPassword })
      .expect(200);
    const customerToken = customerLogin.body.accessToken as string;

    const requestPayload = {
      serviceId,
      description: 'Please restore support service for the test tenant.',
      priority: 'High',
    };
    const idempotencyKey = randomUUID();
    const duplicateSubmissions = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/requests')
        .auth(customerToken, { type: 'bearer' })
        .set('Idempotency-Key', idempotencyKey)
        .send(requestPayload),
      request(app.getHttpServer())
        .post('/api/v1/requests')
        .auth(customerToken, { type: 'bearer' })
        .set('Idempotency-Key', idempotencyKey)
        .send(requestPayload),
    ]);
    expect(duplicateSubmissions.map(({ status }) => status)).toEqual([
      201, 201,
    ]);
    const createdRequest = duplicateSubmissions[0];
    expect(duplicateSubmissions[1].body.id).toBe(createdRequest.body.id);
    const requestId = createdRequest.body.id as number;
    expect(createdRequest.body.status).toBe('Submitted');

    await request(app.getHttpServer())
      .post('/api/v1/requests')
      .auth(customerToken, { type: 'bearer' })
      .set('Idempotency-Key', idempotencyKey)
      .send({
        ...requestPayload,
        description: 'This payload differs from the original submission.',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${requestId}/assign`)
      .auth(adminToken, { type: 'bearer' })
      .send({ agentId })
      .expect(200);

    const competingStatusUpdates = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/requests/${requestId}/status`)
        .auth(adminToken, { type: 'bearer' })
        .send({ status: 'In Progress' }),
      request(app.getHttpServer())
        .patch(`/api/v1/requests/${requestId}/status`)
        .auth(adminToken, { type: 'bearer' })
        .send({ status: 'In Progress' }),
    ]);
    expect(competingStatusUpdates.map(({ status }) => status).sort()).toEqual([
      200, 400,
    ]);
    const resolvedRequest = await request(app.getHttpServer())
      .patch(`/api/v1/requests/${requestId}/status`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'Resolved' })
      .expect(200);
    expect(resolvedRequest.body.status).toBe('Resolved');

    const customerRequest = await request(app.getHttpServer())
      .get(`/api/v1/requests/${requestId}`)
      .auth(customerToken, { type: 'bearer' })
      .expect(200);
    expect(customerRequest.body).toMatchObject({
      id: requestId,
      customerId,
      serviceId,
      status: 'Resolved',
    });

    const serviceFromDatabase = await dataSource
      .getRepository(CatalogService)
      .findOneBy({ id: serviceId });
    expect(serviceFromDatabase).toBeTruthy();

    const outboxEventCount = await dataSource
      .getRepository(NotificationOutbox)
      .createQueryBuilder('event')
      .where('event.eventKey LIKE :requestEventPrefix', {
        requestEventPrefix: `service-request:${requestId}:%`,
      })
      .getCount();
    expect(outboxEventCount).toBeGreaterThanOrEqual(5);
  });

  it('uses the safe error contract for invalid query parameters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/services?page=1000001')
      .auth(adminToken, { type: 'bearer' })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      requestId: expect.any(String),
    });
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });

  it('creates, searches, versions, and access-controls knowledge documents', async () => {
    const createPayload = {
      name: `E2E Knowledge ${suffix}`,
      description: 'Knowledge document for the end-to-end test.',
      category: 'FAQ',
      department: 'Customer Support',
      accessLevel: 'INTERNAL',
      status: 'PUBLISHED',
      content: 'Validated test knowledge content.',
    };

    await request(app.getHttpServer())
      .get('/api/v1/knowledge-base/documents')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/documents')
      .auth(agentToken, { type: 'bearer' })
      .send(createPayload)
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/documents')
      .auth(adminToken, { type: 'bearer' })
      .send(createPayload)
      .expect(201);
    const documentId = created.body.documentId as string;
    expect(created.body).toMatchObject({
      version: 1,
      status: 'PUBLISHED',
      createdByUserId: expect.any(Number),
    });

    const concurrentVersions = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/knowledge-base/documents/${documentId}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ content: 'Revised test knowledge content, edit A.' }),
      request(app.getHttpServer())
        .patch(`/api/v1/knowledge-base/documents/${documentId}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ content: 'Revised test knowledge content, edit B.' }),
    ]);
    expect(concurrentVersions.map(({ status }) => status)).toEqual([200, 200]);
    const concurrentVersionNumbers = concurrentVersions
      .map(({ body }) => body.version as number)
      .sort((left, right) => left - right);
    expect(concurrentVersionNumbers).toEqual([2, 3]);

    const agentRead = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/documents/${documentId}`)
      .auth(agentToken, { type: 'bearer' })
      .expect(200);
    expect(agentRead.body).toMatchObject({
      version: 1,
      content: 'Validated test knowledge content.',
    });

    for (const version of concurrentVersionNumbers) {
      await request(app.getHttpServer())
        .get(
          `/api/v1/knowledge-base/documents/${documentId}/versions/${version}`,
        )
        .auth(agentToken, { type: 'bearer' })
        .expect(404);
    }

    const versions = await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/documents/${documentId}/versions`)
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(versions.body).toMatchObject({ total: 3 });

    const search = await request(app.getHttpServer())
      .get(
        `/api/v1/knowledge-base/documents?search=${encodeURIComponent(suffix)}&category=FAQ`,
      )
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0]).not.toHaveProperty('content');

    const confidential = await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/documents')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: `E2E Confidential ${suffix}`,
        category: 'ESCALATION_PROCEDURE',
        department: 'Security',
        accessLevel: 'CONFIDENTIAL',
        status: 'PUBLISHED',
        content: 'Confidential test-only content.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(
        `/api/v1/knowledge-base/documents/${confidential.body.documentId as string}`,
      )
      .auth(agentToken, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/knowledge-base/documents/${documentId}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ status: 'ARCHIVED' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/knowledge-base/documents/${documentId}`)
      .auth(agentToken, { type: 'bearer' })
      .expect(404);
  });

  it('answers customer questions from public knowledge and blocks restricted sources', async () => {
    const publicContent = `publicassistantguide${suffix.replaceAll('-', '')}`;
    const publicDocument = await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/documents')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: `E2E Public Assistant Guide ${suffix}`,
        category: 'TROUBLESHOOTING_GUIDE',
        department: 'Customer Support',
        accessLevel: 'PUBLIC',
        status: 'PUBLISHED',
        content: `Follow this public instruction: ${publicContent}.`,
      })
      .expect(201);
    const privateContent = `privateassistantguide${suffix.replaceAll('-', '')}`;
    const internalDocument = await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/documents')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: `E2E Internal Assistant Guide ${suffix}`,
        category: 'SERVICE_GUIDELINE',
        department: 'Customer Support',
        accessLevel: 'INTERNAL',
        status: 'PUBLISHED',
        content: `Internal instruction: ${privateContent}.`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/ai/customer-support/ask')
      .send({ question: 'What should I do?' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/ai/customer-support/ask')
      .auth(adminToken, { type: 'bearer' })
      .send({ question: 'What should I do?' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/ai/customer-support/ask')
      .auth(customerToken, { type: 'bearer' })
      .send({ question: '  ' })
      .expect(400);

    mockedLlmProvider.generateAnswer.mockClear();
    const answer = await request(app.getHttpServer())
      .post('/api/v1/ai/customer-support/ask')
      .auth(customerToken, { type: 'bearer' })
      .send({ question: `How do I use ${publicContent}?` })
      .expect(200);
    expect(answer.body).toMatchObject({
      answer: 'Follow the published troubleshooting instructions.',
      confidence: null,
      sources: [
        {
          documentId: publicDocument.body.documentId,
          documentName: `E2E Public Assistant Guide ${suffix}`,
        },
      ],
    });

    const privateAnswer = await request(app.getHttpServer())
      .post('/api/v1/ai/customer-support/ask')
      .auth(customerToken, { type: 'bearer' })
      .send({ question: `What is ${privateContent}?` })
      .expect(200);
    expect(privateAnswer.body.sources).toEqual([]);
    expect(privateAnswer.body.answer).toContain(
      'could not find published information',
    );
    expect(mockedLlmProvider.generateAnswer).toHaveBeenCalledTimes(1);

    const agentAnswer = await request(app.getHttpServer())
      .post('/api/v1/ai/customer-support/ask')
      .auth(agentToken, { type: 'bearer' })
      .send({ question: `What is ${privateContent}?` })
      .expect(200);
    expect(agentAnswer.body.sources).toMatchObject([
      {
        documentId: internalDocument.body.documentId,
        documentName: `E2E Internal Assistant Guide ${suffix}`,
      },
    ]);

    const confidentialContent = `confidentialassistantguide${suffix.replaceAll('-', '')}`;
    await request(app.getHttpServer())
      .post('/api/v1/knowledge-base/documents')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: `E2E Confidential Assistant Guide ${suffix}`,
        category: 'ESCALATION_PROCEDURE',
        department: 'Security',
        accessLevel: 'CONFIDENTIAL',
        status: 'PUBLISHED',
        content: `Confidential instruction: ${confidentialContent}.`,
      })
      .expect(201);
    for (const token of [customerToken, agentToken]) {
      const confidentialAnswer = await request(app.getHttpServer())
        .post('/api/v1/ai/customer-support/ask')
        .auth(token, { type: 'bearer' })
        .send({ question: `What is ${confidentialContent}?` })
        .expect(200);
      expect(confidentialAnswer.body.sources).toEqual([]);
    }
  });
});
