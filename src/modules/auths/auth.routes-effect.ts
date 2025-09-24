// src/modules/auths/auth.routes-effect.ts
// Effect-based authentication routes using patterns from user.routes-effect-platform.ts
// Implements login and register endpoints with Effect context

import { Effect, Context, Layer } from 'effect';
import { Router, Request, Response, NextFunction } from 'express';
import { UserServiceEffectTag, UserServiceEffectLive } from '../users/user.service-effect';
import { validateCreateUser } from '../users/user.validator-effect';
import { UserResponse, CreateUserData, User } from '../users/user.types';
import { makeDatabaseLayer } from '../../shared/database/effect-database';
import { generateToken } from '../../shared/middleware/auth';
import { config } from '../../config';

/**
 * Effect-based Authentication Routes
 *
 * This implementation demonstrates:
 * 1. Effect context-based request handlers for authentication
 * 2. Integration with Effect-based user service
 * 3. Validation pipeline using Effect patterns
 * 4. Express compatibility for existing auth endpoints
 * 5. Structured error handling with Effect patterns
 *
 * Endpoints:
 * - POST /login - User authentication with JWT token generation
 * - POST /register - User registration using Effect-based user service
 */

// Authentication-specific error types
export class LoginError extends Error {
  readonly _tag = 'LoginError';
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
  }
}

export class CredentialsError extends Error {
  readonly _tag = 'CredentialsError';
  constructor(message: string, public readonly statusCode: number = 401) {
    super(message);
  }
}

export class RegistrationError extends Error {
  readonly _tag = 'RegistrationError';
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
  }
}

// Auth service interface for login operations
export interface AuthTokenService {
  readonly generateAuthToken: (user: UserResponse) => Effect.Effect<string, never>;
}

// Auth service tag for dependency injection
export class AuthTokenServiceTag extends Context.Tag('AuthTokenService')<AuthTokenServiceTag, AuthTokenService>() {}

// Auth token service implementation
const makeAuthTokenService = (): AuthTokenService => ({
  generateAuthToken: (user: UserResponse) =>
    Effect.sync(() => {
      return generateToken(user.username, user.roles, user.nickname);
    }),
});

// Auth token service layer
export const AuthTokenServiceLayer = Layer.succeed(AuthTokenServiceTag, makeAuthTokenService());

/**
 * Effect-based handler pipeline for POST /login
 * Demonstrates complete login flow: validation -> authentication -> token generation
 */
export const loginEffect = (req: Request) =>
  Effect.gen(function* () {
    // Input validation
    const { username, password } = req.body;

    if (!username || !password) {
      return yield* Effect.fail(new LoginError('Missing required fields: username, password'));
    }

    // Get user service
    const userService = yield* UserServiceEffectTag;

    // Find and validate user
    const rawUser = yield* userService.getUser(username).pipe(
      Effect.catchAll(error => {
        if (error._tag === 'UserNotFoundError') {
          return Effect.fail(new LoginError('User not found', 404));
        }
        return Effect.fail(new LoginError(`Database error: ${error.message}`, 500));
      }),
    );

    // Validate password - need to cast rawUser to User type
    const user = yield* userService.validateUser(rawUser as User, password).pipe(
      Effect.catchAll(error => {
        if (error._tag === 'UserUnauthorizedError') {
          return Effect.fail(new LoginError('Invalid credentials', 401));
        }
        return Effect.fail(new LoginError(`Validation error: ${error.message}`, 500));
      }),
    );

    // Generate JWT token - cast user to UserResponse if needed
    const tokenService = yield* AuthTokenServiceTag;
    const token = yield* tokenService.generateAuthToken(user as UserResponse);

    // Return auth response
    return {
      'user-auth-token': token,
      expires_in: config.jwt.expiresIn,
      token_type: 'Bearer',
    };
  }).pipe(
    Effect.provide(AuthTokenServiceLayer),
    Effect.provide(UserServiceEffectLive),
    Effect.provide(makeDatabaseLayer({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'scavenger_hunt',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })),
  );

/**
 * Effect-based handler pipeline for POST /register
 * Demonstrates registration flow: validation -> user creation
 */
export const registerEffect = (req: Request) =>
  Effect.gen(function* () {
    // Validation (reusing user validation from Effect user service)
    const validated = yield* validateCreateUser({ body: req.body }).pipe(
      Effect.catchAll(error =>
        Effect.fail(new RegistrationError(`Validation failed: ${error.message}`, 400)),
      ),
    );

    // Create user using Effect-based service
    const userService = yield* UserServiceEffectTag;
    const newUser = yield* userService.createUser(validated.body as CreateUserData).pipe(
      Effect.catchAll(error => {
        if (error._tag === 'UserConflictError') {
          return Effect.fail(new RegistrationError(error.message, 409));
        }
        return Effect.fail(new RegistrationError(`Registration failed: ${error.message}`, 403));
      }),
    );

    // Return registration response
    return {
      'user-id': newUser.user_id,
      username: newUser.username,
    };
  }).pipe(
    Effect.provide(UserServiceEffectLive),
    Effect.provide(makeDatabaseLayer({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'scavenger_hunt',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    })),
  );

/**
 * Express integration helper (reusing pattern from user.routes-effect-platform.ts)
 * Converts Effect-based handlers to Express middleware
 */
export const effectToExpress = <T>(
  effectHandler: (req: Request) => Effect.Effect<T, unknown, unknown>,
) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      // Use explicit typing to handle Effect type resolution
      const effectWithHandler = effectHandler(req);
      // Cast to handle the never requirement constraint
      const result = await Effect.runPromise(effectWithHandler as Effect.Effect<T, unknown, never>);

      // Handle different response types
      if (result === undefined || result === null) {
        res.status(204).send();
      } else if (req.method === 'POST' && req.path.includes('login')) {
        res.status(201).json(result); // Login returns 201
      } else if (req.method === 'POST') {
        res.status(200).json(result); // Register returns 200
      } else {
        res.json(result);
      }
    } catch (error) {
      // Handle Effect-wrapped errors
      let originalError = error;
      if (error && typeof error === 'object' && 'toJSON' in error) {
        const errorJson = (error as { toJSON: () => { cause?: { defect?: unknown } } }).toJSON();
        if (errorJson?.cause?.defect) {
          originalError = errorJson.cause.defect;
        }
      }

      // Map Effect errors to HTTP responses
      if (originalError instanceof LoginError) {
        res.status(originalError.statusCode).json({ error: originalError.message });
      } else if (originalError instanceof CredentialsError) {
        res.status(originalError.statusCode).json({ error: originalError.message });
      } else if (originalError instanceof RegistrationError) {
        res.status(originalError.statusCode).json({ error: originalError.message });
      } else if (originalError && typeof originalError === 'object' && '_tag' in originalError) {
        // Handle service layer errors
        const taggedError = originalError as { _tag: string; message: string };
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
          case 'UserUnauthorizedError':
            res.status(401).json({ error: taggedError.message });
            break;
          default:
            console.error('Error during auth operation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
      } else {
        console.error('Error during auth operation:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

/**
 * Express Router with Effect-enhanced routes
 * Implements the same endpoints as auth.routes.ts but with Effect patterns
 */
export const createEffectAuthRouter = (): Router => {
  const router = Router();

  // POST /login - Login with Effect pipeline
  router.post('/login', effectToExpress(loginEffect));

  // POST /register - Register with Effect pipeline
  router.post('/register', effectToExpress(registerEffect));

  return router;
};

/**
 * Usage example:
 *
 * ```typescript
 * import express from 'express';
 * import { createEffectAuthRouter } from './auth.routes-effect';
 *
 * const app = express();
 * app.use(express.json());
 * app.use('/hunt/auth', createEffectAuthRouter());
 * ```
 *
 * Benefits Demonstrated:
 *
 * 1. **Effect Context Integration**: Uses patterns from user.routes-effect-platform.ts
 * 2. **Composable Pipelines**: Validation → Service → Token Generation in Effect.gen
 * 3. **Dependency Injection**: Services provided through Layer system
 * 4. **Structured Error Handling**: Custom auth errors with Effect patterns
 * 5. **Express Compatibility**: effectToExpress bridges Effect and Express
 * 6. **Service Integration**: Works with existing Effect-based user service
 * 7. **Consistent Architecture**: Follows established Effect patterns in the project
 */