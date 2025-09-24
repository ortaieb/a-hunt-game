// src/modules/users/user.routes-effect-platform.ts
// Effect-based user routes using @effect/platform patterns with reduced scope
// Phase 1: Implements GET / and POST / endpoints with Effect context

import { Effect, Context, Layer, pipe } from 'effect';
import { Router, Request, Response, NextFunction } from 'express';
import { HttpApiDecodeError } from '@effect/platform/HttpApiError';
import {
  UserServiceEffectTag,
  UserServiceEffectLive,
  UserServiceEffect,
} from './user.service-effect';
import { validateCreateUser, validateListUsers } from './user.validator-effect';
import { UserResponse, CreateUserData, UserFilters } from './user.types';
import { PgDrizzle } from '../../shared/database/effect-database';
import { makeDatabaseLayer } from '../../shared/database/effect-database';

/**
 * Effect-based User Routes with @effect/platform integration
 *
 * This implementation demonstrates:
 * 1. Effect context-based request handlers
 * 2. Authentication and authorization in Effect pipeline
 * 3. Integration with Effect-based services and validation
 * 4. Express compatibility for Phase 1 implementation
 * 5. Structured error handling with Effect patterns
 *
 * Phase 1 Scope: GET / and POST / endpoints only
 */

// Authentication context and service
export class AuthenticationError extends Error {
  readonly _tag = 'AuthenticationError';
  constructor(
    message: string,
    public readonly statusCode: number = 401,
  ) {
    super(message);
  }
}

export class AuthorizationError extends Error {
  readonly _tag = 'AuthorizationError';
  constructor(
    message: string,
    public readonly statusCode: number = 403,
  ) {
    super(message);
  }
}

// Authentication service interface
export interface AuthService {
  readonly authenticateToken: (
    token: string | undefined,
  ) => Effect.Effect<AuthenticatedUser, AuthenticationError>;
  readonly requireRole: (
    user: AuthenticatedUser,
    role: string,
  ) => Effect.Effect<AuthenticatedUser, AuthorizationError>;
}

export interface AuthenticatedUser {
  readonly username: string;
  readonly roles: readonly string[];
}

// Authentication service tag for dependency injection
export class AuthServiceTag extends Context.Tag('AuthService')<AuthServiceTag, AuthService>() {}

// Mock authentication service implementation for Phase 1
const makeAuthService = (): AuthService => ({
  authenticateToken: (authHeader: string | undefined) =>
    Effect.sync(() => {
      if (!authHeader?.startsWith('Bearer ')) {
        throw new AuthenticationError('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);

      // Mock token validation - replace with real JWT validation
      if (token === 'admin-token') {
        return { username: 'admin@example.com', roles: ['game.admin'] };
      }
      if (token === 'user-token') {
        return { username: 'test@example.com', roles: ['user'] };
      }

      throw new AuthenticationError('Invalid token');
    }),

  requireRole: (user: AuthenticatedUser, requiredRole: string) =>
    Effect.sync(() => {
      if (!user.roles.includes(requiredRole)) {
        throw new AuthorizationError('Insufficient permissions');
      }
      return user;
    }),
});

// Auth service layer
export const AuthServiceLayer = Layer.succeed(AuthServiceTag, makeAuthService());

/**
 * Effect-based handler pipeline for GET / (List Users)
 * Demonstrates complete Effect pipeline with auth -> validation -> service
 */
export const listUsersEffect = (req: Request) =>
  Effect.gen(function* () {
    // Authentication
    const authService = yield* AuthServiceTag;
    const user = yield* authService.authenticateToken(req.headers.authorization);

    // Authorization
    yield* authService.requireRole(user, 'game.admin');

    // Validation
    const validated = yield* validateListUsers({ query: req.query });

    // Business logic
    const userService = yield* UserServiceEffectTag;
    const users = yield* userService.listUsers(validated.query || ({} as UserFilters));

    return users;
  }).pipe(
    Effect.provide(AuthServiceLayer),
    Effect.provide(UserServiceEffectLive),
    Effect.provide(
      makeDatabaseLayer({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'test',
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
      }),
    ),
  );

/**
 * Effect-based handler pipeline for POST / (Create User)
 * Demonstrates complete Effect pipeline with auth -> validation -> service
 */
export const createUserEffect = (req: Request) =>
  Effect.gen(function* () {
    // Authentication
    const authService = yield* AuthServiceTag;
    const user = yield* authService.authenticateToken(req.headers.authorization);

    // Authorization
    yield* authService.requireRole(user, 'game.admin');

    // Validation
    const validated = yield* validateCreateUser({ body: req.body });

    // Business logic
    const userService = yield* UserServiceEffectTag;
    const createdUser = yield* userService.createUser(validated.body as CreateUserData);

    // Transform to API response format
    return {
      'user-id': createdUser.user_id,
      username: createdUser.username,
    };
  }).pipe(
    Effect.provide(AuthServiceLayer),
    Effect.provide(UserServiceEffectLive),
    Effect.provide(
      makeDatabaseLayer({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'test',
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
      }),
    ),
  );

/**
 * Express integration helper
 * Converts Effect-based handlers to Express middleware
 */
export const effectToExpress =
  <T>(effectHandler: (req: Request) => Effect.Effect<T, any, any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Use explicit typing to handle Effect type resolution
      const effectWithHandler = effectHandler(req);
      // Cast to handle the never requirement constraint
      const result = await Effect.runPromise(effectWithHandler as Effect.Effect<T, any, never>);

      // Handle different response types
      if (result === undefined || result === null) {
        res.status(204).send();
      } else if (req.method === 'POST') {
        res.status(201).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      // Handle Effect-wrapped errors
      let originalError = error;
      if (error && typeof error === 'object' && 'toJSON' in error) {
        const errorJson = (error as any).toJSON();
        if (errorJson?.cause?.defect) {
          originalError = errorJson.cause.defect;
        }
      }

      // Map Effect errors to HTTP responses
      if (originalError instanceof AuthenticationError) {
        res.status(originalError.statusCode).json({ error: originalError.message });
      } else if (originalError instanceof AuthorizationError) {
        res.status(originalError.statusCode).json({ error: originalError.message });
      } else if (originalError && typeof originalError === 'object' && '_tag' in originalError) {
        // Handle service layer errors
        const taggedError = originalError as any;
        switch (taggedError._tag) {
          case 'UserConflictError':
            res.status(409).json({ error: taggedError.message });
            break;
          case 'UserNotFoundError':
            res.status(404).json({ error: taggedError.message });
            break;
          case 'UserServiceValidationError':
            res.status(400).json({ error: taggedError.message });
            break;
          default:
            next(error);
        }
      } else {
        next(error);
      }
    }
  };

/**
 * Express Router with Effect-enhanced routes
 * Phase 1: Only GET / and POST / endpoints
 */
export const createEffectRouter = (): Router => {
  const router = Router();

  // GET / - List users with Effect pipeline
  router.get('/', effectToExpress(listUsersEffect));

  // POST / - Create user with Effect pipeline
  router.post('/', effectToExpress(createUserEffect));

  return router;
};

/**
 * Usage example:
 *
 * ```typescript
 * import express from 'express';
 * import { createEffectRouter } from './user.routes-effect-platform';
 *
 * const app = express();
 * app.use(express.json());
 * app.use('/api/users', createEffectRouter());
 * ```
 *
 * Benefits Demonstrated:
 *
 * 1. **Effect Context Integration**: Uses @effect/platform concepts with AuthServiceTag
 * 2. **Composable Pipelines**: Auth -> Validation -> Service in Effect.gen
 * 3. **Dependency Injection**: Services provided through Layer system
 * 4. **Structured Error Handling**: Custom errors with Effect patterns
 * 5. **Express Compatibility**: effectToExpress bridges Effect and Express
 * 6. **Reduced Scope**: Phase 1 focuses on GET / and POST / only
 * 7. **Integration Ready**: Works with existing Effect services and validators
 */
