// src/modules/users/user.routes-effect-simple.ts
// Simplified Effect-based REST endpoints for user operations
// This demonstrates basic Effect patterns that integrate with existing Express routes

import { Effect, Context, Layer, Schema } from 'effect';
import {
  UserServiceEffectTag,
  UserServiceEffect,
  UserConflictError,
  UserNotFoundError,
  UserUnauthorizedError,
} from './user.service-effect';
import {
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser,
  validateListUsers,
  ValidationError,
} from './user.validator-effect';
import { UserResponse, UserFilters } from './user.types';

/**
 * Simplified Effect-based User Routes
 *
 * This approach focuses on core Effect patterns without the complexity
 * of full HttpApi integration, allowing for easier integration with
 * existing Express routes.
 *
 * Key Effect concepts demonstrated:
 * 1. Service composition using Effect.gen
 * 2. Integration with Effect-based service layer
 * 3. Structured error handling
 * 4. Dependency injection
 * 5. Composable business logic
 */

// Simplified error types for HTTP responses
export class EffectHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export class EffectValidationError extends EffectHttpError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export class EffectUnauthorizedError extends EffectHttpError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class EffectForbiddenError extends EffectHttpError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class EffectNotFoundError extends EffectHttpError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

export class EffectConflictError extends EffectHttpError {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Authentication Service Interface
 */
export interface AuthEffectService {
  readonly authenticateToken: (token: string) => Effect.Effect<{ username: string; roles: string[] }, EffectUnauthorizedError>;
  readonly requireRole: (userRoles: string[], requiredRole: string) => Effect.Effect<void, EffectForbiddenError>;
}

export const AuthEffectServiceTag = Context.GenericTag<AuthEffectService>('AuthEffectService');

/**
 * Helper to extract and validate authorization token
 */
export const extractAndValidateToken = (authHeader?: string) =>
  Effect.gen(function* () {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return yield* Effect.fail(new EffectUnauthorizedError('Missing or invalid authorization header'));
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const authService = yield* AuthEffectServiceTag;
    const user = yield* authService.authenticateToken(token);

    return user;
  });

/**
 * Require admin role for operations
 */
export const requireAdminRole = (user: { username: string; roles: string[] }) =>
  Effect.gen(function* () {
    const authService = yield* AuthEffectServiceTag;
    return yield* authService.requireRole(user.roles, 'game.admin');
  });

/**
 * Effect-based User Operations
 * These can be used in Express route handlers with Effect.runPromise
 */

export const listUsersEffect = (query: unknown, authHeader?: string) =>
  Effect.gen(function* () {
    // Authentication & Authorization
    const user = yield* extractAndValidateToken(authHeader);
    yield* requireAdminRole(user);

    // Validate query parameters
    const validated = yield* validateListUsers({ query: query || {} }).pipe(
      Effect.mapError((error) => new EffectValidationError('Invalid query parameters', error))
    );

    // Call service
    const userService = yield* UserServiceEffectTag;
    const filters: UserFilters = validated.query || {};
    const users = yield* userService.listUsers(filters).pipe(
      Effect.mapError((error) => new EffectValidationError('Failed to list users', error))
    );

    return users;
  });

export const getUserEffect = (username: string, authHeader?: string) =>
  Effect.gen(function* () {
    // Authentication (no admin role required)
    yield* extractAndValidateToken(authHeader);

    // Call service
    const userService = yield* UserServiceEffectTag;
    const user = yield* userService.getUser(username).pipe(
      Effect.mapError((error) => {
        if (error._tag === 'UserNotFoundError') {
          return new EffectNotFoundError(error.message);
        }
        return new EffectValidationError('Failed to get user', error);
      })
    );

    // Transform to response format (remove password_hash)
    const { password_hash, ...userResponse } = user as any;
    return userResponse;
  });

export const createUserEffect = (body: unknown, authHeader?: string) =>
  Effect.gen(function* () {
    // Authentication & Authorization
    const user = yield* extractAndValidateToken(authHeader);
    yield* requireAdminRole(user);

    // Validate using Effect validator
    const validated = yield* validateCreateUser({ body }).pipe(
      Effect.mapError((error) => new EffectValidationError('Validation failed', error))
    );

    // Call service
    const userService = yield* UserServiceEffectTag;
    const createdUser = yield* userService.createUser(validated.body).pipe(
      Effect.mapError((error) => {
        if (error._tag === 'UserConflictError') {
          return new EffectConflictError(error.message);
        }
        return new EffectValidationError('Failed to create user', error);
      })
    );

    // Transform to expected response format
    return {
      'user-id': createdUser.user_id,
      username: createdUser.username,
    };
  });

export const updateUserEffect = (username: string, body: unknown, authHeader?: string) =>
  Effect.gen(function* () {
    // Authentication & Authorization
    const user = yield* extractAndValidateToken(authHeader);
    yield* requireAdminRole(user);

    // Validate using Effect validator
    const validated = yield* validateUpdateUser({
      params: { username },
      body,
    }).pipe(
      Effect.mapError((error) => new EffectValidationError('Validation failed', error))
    );

    // Call service
    const userService = yield* UserServiceEffectTag;
    const updatedUser = yield* userService.updateUser(username, validated.body).pipe(
      Effect.mapError((error) => {
        if (error._tag === 'UserNotFoundError') {
          return new EffectNotFoundError(error.message);
        }
        return new EffectValidationError('Failed to update user', error);
      })
    );

    // Transform to expected response format
    return {
      'user-id': updatedUser.user_id,
      username: updatedUser.username,
    };
  });

export const deleteUserEffect = (username: string, authHeader?: string) =>
  Effect.gen(function* () {
    // Authentication & Authorization
    const user = yield* extractAndValidateToken(authHeader);
    yield* requireAdminRole(user);

    // Validate using Effect validator
    yield* validateDeleteUser({
      params: { username },
    }).pipe(
      Effect.mapError((error) => new EffectValidationError('Validation failed', error))
    );

    // Call service
    const userService = yield* UserServiceEffectTag;
    yield* userService.deleteUser(username).pipe(
      Effect.mapError((error) => {
        if (error._tag === 'UserNotFoundError') {
          return new EffectNotFoundError(error.message);
        }
        return new EffectValidationError('Failed to delete user', error);
      })
    );

    return undefined; // 204 No Content
  });

/**
 * Express Route Integration Helper
 * Converts Effect operations to Express-compatible handlers
 */
export const runEffectRoute = <T>(
  effect: Effect.Effect<T, EffectHttpError>,
  dependencies: Layer.Layer<any>
) => {
  return async (req: any, res: any, next: any) => {
    try {
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(dependencies))
      );

      if (result === undefined) {
        res.status(204).send();
      } else {
        res.json(result);
      }
    } catch (error) {
      if (error instanceof EffectHttpError) {
        res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * Usage Examples with Express Integration:
 *
 * // Express route setup
 * import express from 'express';
 * import { listUsersEffect, runEffectRoute } from './user.routes-effect-simple';
 *
 * const router = express.Router();
 *
 * router.get('/', (req, res, next) => {
 *   const effect = listUsersEffect(req.query, req.headers.authorization);
 *   const handler = runEffectRoute(effect, dependencies);
 *   return handler(req, res, next);
 * });
 *
 * // Or using a helper function
 * router.get('/', runEffectRoute(
 *   listUsersEffect(req.query, req.headers.authorization),
 *   dependencies
 * ));
 *
 * // Direct usage with Effect.runPromise
 * const result = await Effect.runPromise(
 *   createUserEffect(userData, authToken).pipe(
 *     Effect.provide(UserServiceEffectLive),
 *     Effect.provide(AuthEffectServiceLive),
 *     Effect.provide(DatabaseLive)
 *   )
 * );
 */

/**
 * Comparison with Traditional Express Routes:
 *
 * Traditional Express (user.routes.ts):
 * - Direct Express middleware and route handlers
 * - Manual error handling with try/catch
 * - Service calls with await
 * - Imperative programming style
 *
 * Effect-Enhanced Express (user.routes-effect-simple.ts):
 * - Effect-based business logic with Express integration
 * - Structured error handling with typed errors
 * - Composable operations using Effect.gen
 * - Dependency injection through Effect Context
 * - Functional programming style with imperative Express layer
 * - Easy testing with Effect's testing patterns
 * - Better error propagation and handling
 * - Type-safe composition of authentication, validation, and business logic
 */