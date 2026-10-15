<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

Architecture decision: [Database selection — MySQL vs MongoDB](../docs/database-selection.md).

NestJS Fastify adapter demonstration: [Fastify implementation and Express comparison](../docs/fastify-implementation.md).

API conventions and compatibility: [API design](../docs/api-design.md).

Interactive API reference: [Swagger/OpenAPI guide](../docs/swagger-openapi.md).

In-app notifications: [Notification architecture and API](../docs/notifications.md).

The NestJS API serves Swagger UI at `http://localhost:3000/api/docs` and its
OpenAPI JSON at `http://localhost:3000/api/docs-json` by default. Set
`SWAGGER_ENABLED=false` to disable both routes.

## Standalone Express demonstration

The separate Express server demonstrates middleware, JWT authentication, input validation, safe request logging, and centralized errors without changing or starting the NestJS server.

```bash
# Start on EXPRESS_PORT (default 3001); reads .env if present.
npm run start:express

# Or after npm run build:
npm run start:express:prod
```

Set `JWT_SECRET` to the same secret used by the NestJS API. The Express server verifies signed HS256 bearer tokens through `passport-jwt`; the protected route is available to Admin and Manager roles. `EXPRESS_PORT` is independent of NestJS `PORT`.

| Method | Path                       | Behavior                                                                      |
| ------ | -------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/api/v1/health`           | Returns `{ "status": "ok" }`.                                                 |
| GET    | `/api/v1/system/status`    | Returns status and process uptime in seconds.                                 |
| GET    | `/api/v1/system/protected` | Requires a valid JWT and an Admin or Manager role.                            |
| POST   | `/api/v1/demo/echo`        | Accepts only `{ "message": "text" }`, with a trimmed 1–500 character message. |

Example:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/v1/demo/echo `
  -ContentType 'application/json' -Body '{"message":"hello"}'
```

Request logs contain the generated request ID, method, path (without query string), status, and duration. Authorization headers and request bodies are not logged. The server uses a separate listener and does not initialize NestJS modules or connect to either database.

## NestJS Fastify demonstration

The optional Fastify adapter demo uses the same NestJS controller patterns, validation pipe, JWT strategy, and RBAC guards on a separate port. It does not replace the existing Express-backed NestJS application or the standalone Express demonstration.

```bash
# Development, default FASTIFY_PORT=3002
npm run start:fastify

# Production after npm run build
npm run start:fastify:prod
```

See [Fastify implementation](../docs/fastify-implementation.md) for endpoint examples, adapter choices, and Express/Fastify trade-offs.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## MongoDB reporting and notifications

MySQL remains the source of truth for users, customers, services, and service requests. MongoDB stores only a small `service_requests` reporting read model (request ID, service category, status, and source timestamps) plus user notifications. Customer and service-request records are not otherwise copied into MongoDB.

### Collections and indexes

- `service_requests`: unique `sourceRequestId`; compound `{ status: 1, serviceCategory: 1 }` and `{ serviceCategory: 1, status: 1 }` indexes support aggregation with and without an exact category filter; `{ serviceCategory: 1, requestCreatedAt: -1 }` supports category/time reporting. Mongoose timestamps record read-model creation/update times; source request timestamps are kept separately.
- `notifications`: `recipientUserId`, type, title/message, optional related request ID, read state and timestamps. Compound indexes support recipient chronological reads and unread filtering. No TTL index is configured because the platform has no notification-retention policy.

### MySQL-to-MongoDB synchronization

The additive TypeORM migration `1792100000000-AddServiceRequestSyncOutbox` creates a MySQL outbox and queues existing request IDs for initial backfill. Each service-request create, status update, and assignment writes an outbox event in the same MySQL transaction as the source change. A service-category edit queues a refresh for requests using that service. A worker reads current state from MySQL and performs an idempotent MongoDB upsert keyed by `sourceRequestId`.

MySQL and MongoDB do not share a transaction. The outbox provides at-least-once delivery: successful events are marked processed; failed writes retain their row and retry with exponential backoff capped at five minutes. Duplicate events are safe because synchronization uses upserts. Reporting is eventually consistent (normally within a few seconds); while MongoDB is unavailable, request writes remain available in MySQL, but analytics and notification endpoints return `503`. Analytics also returns `503` while any outbox event is pending, rather than returning a misleading zero or stale result during backfill/synchronization. Check `service_request_sync_outbox` for unprocessed rows and their `attempts`/`last_error` when investigating sync delays. The worker retries pending events automatically.

Open requests are exactly `Submitted`, `Assigned`, `In Progress`, and `Pending Customer`. `Resolved` and `Closed` are excluded. The API uses a MongoDB aggregation `$match` followed by `$group` and returns an empty `items` array and a zero total when no open requests are present:

```http
GET /api/v1/analytics/open-requests-by-category
GET /api/v1/analytics/open-requests-by-category?category=Support
```

Example response:

```json
{
  "items": [
    { "category": "Support", "openRequestCount": 3 },
    { "category": "Network", "openRequestCount": 1 }
  ],
  "totalOpenRequests": 4
}
```

The analytics endpoint requires a JWT and one of `Admin`, `Manager`, or `SupportAgent`. Notifications are document-oriented because their recipient-specific read state and content vary independently of relational customer/request records:

- `POST /api/v1/notifications` — Admin/Manager only; creates a notification for an existing user.
- `GET /api/v1/notifications/me?page=1&limit=20&unreadOnly=true&sortOrder=DESC` — any authenticated user; always scoped to the JWT user.
- `PATCH /api/v1/notifications/:id/read` — any authenticated user; only updates a notification owned by the JWT user.

Notification documents must not contain credentials, tokens, or passwords.

### Configuration and running locally

Copy `.env.example` to `.env` and set `JWT_SECRET` and database values for the local environment. `MONGO_URI` is required and validated; for a local app process it can be `mongodb://localhost:27017/customer_platform`. The provided Compose MongoDB service is for local development and has no authentication; configure authentication and TLS in production.

```bash
docker compose up -d mysql mongodb
npm install
npm run migration:run
npm run start:dev
```

The MongoDB connection is lazy so an unavailable MongoDB server does not prevent the Nest app from starting. Document endpoints report temporary unavailability rather than exposing driver errors. MySQL `synchronize` remains disabled; review pending TypeORM migrations before applying them. Run the focused Task 6 tests with:

```bash
npm test -- --runInBand src/config/env.validation.spec.ts src/mongodb src/analytics src/notifications
```

## MySQL agent request query optimization

Service requests remain in MySQL with foreign keys to customers and services and an optional assignee FK to users. Request status uses the existing workflow enum (`Submitted`, `Assigned`, `In Progress`, `Pending Customer`, `Resolved`, `Closed`). Requests now also have a `priority` enum: `Low`, `Normal`, `High`, or `Urgent`; old rows receive `Normal` via the column default. A customer may specify priority on request creation; otherwise priority defaults to `Normal`.

Apply the additive migration after reviewing it:

```bash
npm run migration:run
```

The endpoint below returns only `High` and `Urgent` requests assigned to an actual SupportAgent, and only statuses considered open (`Submitted`, `Assigned`, `In Progress`, `Pending Customer`). `Resolved` and `Closed` are excluded.

```http
GET /api/v1/agents/15/requests/high-priority-open?page=1&limit=20
Authorization: Bearer <access-token>
```

Support agents may query only their own user ID; Admins and Managers may query any valid SupportAgent. Results contain only request ID, service ID, status, priority, assignment and timestamps. Pagination is performed in MySQL and the response is:

```json
{
  "items": [
    {
      "id": 81,
      "serviceId": 5,
      "status": "In Progress",
      "priority": "Urgent",
      "assignedToUserId": 15,
      "assignedAt": "2026-10-01T00:00:00.000Z",
      "createdAt": "2026-09-30T00:00:00.000Z",
      "updatedAt": "2026-10-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

The query uses parameterized filters and the existing `user_roles`/`roles` relationship to verify that the specified user is a SupportAgent, then runs one paginated query over `service_requests` without N+1 joins. The additive index `IDX_service_requests_agent_priority_status_created` covers the assignee equality filter, priority/status filters and created-time ordering. The existing assignee/status index remains in place for prior workloads. No additional category, permission, request-assignment, or audit tables are needed for this query. Existing create, status-update, and assignment writes already use TypeORM transactions; service-request/outbox changes remain atomic.

A read-only `EXPLAIN` was run against the configured development MySQL database after migration. MySQL listed the new composite index as a possible key but chose the existing `created_at` index and estimated one row, consistent with the tiny development data estimate. Do not infer large-table performance from this plan; re-run `EXPLAIN` with representative data after deployment and monitor whether the optimizer selects the composite index.

Run the focused Task 7 tests with:

```bash
npm test -- --runInBand src/requests/requests.service.spec.ts src/requests/agent-requests.controller.spec.ts
```

#   e n t e r p r i s e 
 
 #   e n t e r p r i s e 
 
 #   e n t e r p r i s e - c u s t o m e r - p l a t f o r m 
 
 
