import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import express, {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';
import Joi from 'joi';
import { Passport } from 'passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';

interface DemoAuthenticatedUser {
  userId: number;
  email: string;
  roles: string[];
}

interface DemoJwtPayload {
  sub: number;
  email: string;
  roles: string[];
}

type DemoRequest = Request & { demoUser?: DemoAuthenticatedUser };
type DemoPassport = InstanceType<typeof Passport>;

interface DemoLogger {
  info(message: string): void;
  error(message: string): void;
}

interface ExpressDemoOptions {
  jwtSecret?: string;
  logger?: DemoLogger;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function isAuthenticatedUser(value: unknown): value is DemoJwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'number' &&
    Number.isSafeInteger(payload.sub) &&
    payload.sub > 0 &&
    typeof payload.email === 'string' &&
    Array.isArray(payload.roles) &&
    payload.roles.every((role) => typeof role === 'string')
  );
}

function createJwtAuthentication(passport: DemoPassport): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'express-demo-jwt',
      { session: false },
      (error: unknown, user: DemoAuthenticatedUser | false) => {
        if (error) {
          next(error);
          return;
        }
        if (!user) {
          next(new HttpError(401, 'Authentication required'));
          return;
        }

        (req as DemoRequest).demoUser = user;
        next();
      },
    )(req, res, next);
  };
}

const echoSchema = Joi.object({
  message: Joi.string().trim().min(1).max(500).required(),
})
  .unknown(false)
  .required();

const validateEchoBody: RequestHandler = (req, _res, next) => {
  const { error, value } = echoSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });
  if (error) {
    next(
      new HttpError(
        400,
        'Request body must contain only a non-empty message of at most 500 characters',
      ),
    );
    return;
  }

  req.body = value;
  next();
};

function createErrorHandler(logger: DemoLogger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof HttpError) {
      const errorLabel: Record<number, string> = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
      };
      res.status(error.statusCode).json({
        statusCode: error.statusCode,
        error: errorLabel[error.statusCode] ?? 'Error',
        message: error.message,
      });
      return;
    }

    const parserError = error as { type?: unknown };
    if (parserError?.type === 'entity.parse.failed') {
      res.status(400).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Malformed JSON request body',
      });
      return;
    }
    if (parserError?.type === 'entity.too.large') {
      res.status(413).json({
        statusCode: 413,
        error: 'Payload Too Large',
        message: 'Request body is too large',
      });
      return;
    }

    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const requestId = res.getHeader('X-Request-Id');
    logger.error(
      JSON.stringify({
        event: 'express_demo_error',
        requestId,
        errorName,
      }),
    );
    res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  };
}

export function createExpressDemoApp(options: ExpressDemoOptions = {}) {
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET must be configured to start the Express demo.');
  }

  const logger =
    options.logger ??
    ({
      info: (message: string) => console.info(message),
      error: (message: string) => console.error(message),
    } satisfies DemoLogger);

  const app = express();
  const passport = new Passport();
  passport.use(
    'express-demo-jwt',
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: jwtSecret,
        algorithms: ['HS256'],
        ignoreExpiration: false,
      },
      (payload: unknown, done) => {
        done(
          null,
          isAuthenticatedUser(payload)
            ? {
                userId: payload.sub,
                email: payload.email,
                roles: payload.roles,
              }
            : false,
        );
      },
    ),
  );

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    res.setHeader('X-Request-Id', requestId);
    res.on('finish', () => {
      logger.info(
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Math.max(
            0,
            Number((performance.now() - startedAt).toFixed(2)),
          ),
        }),
      );
    });
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));
  app.use(passport.initialize());

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/v1/system/status', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  app.get(
    '/api/v1/system/protected',
    createJwtAuthentication(passport),
    (req: DemoRequest, res, next) => {
      if (!req.demoUser) {
        next(new HttpError(401, 'Authentication required'));
        return;
      }
      if (
        !req.demoUser.roles.some((role) => ['Admin', 'Manager'].includes(role))
      ) {
        next(new HttpError(403, 'Admin or Manager role required'));
        return;
      }

      res.json({
        message: 'Authenticated access granted',
        userId: req.demoUser.userId,
      });
    },
  );

  app.post('/api/v1/demo/echo', validateEchoBody, (req, res) => {
    res.status(200).json({ message: req.body.message });
  });

  app.use((_req, _res, next) => {
    next(new HttpError(404, 'Route not found'));
  });
  app.use(createErrorHandler(logger));

  return app;
}
