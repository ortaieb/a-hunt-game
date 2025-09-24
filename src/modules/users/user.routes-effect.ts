// src/modules/users/user.routes-effect.ts
// Effect-based REST endpoints for user operations
// This file demonstrates Effect HttpApi patterns based on user.routes.ts

import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { Effect, Context, Layer, Schema, pipe } from 'effect';
import {
  UserServiceEffectTag,
  UserConflictError,
  UserNotFoundError,
  UserUnauthorizedError,
  UserServiceValidationError,
} from './user.service-effect';
import {
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser,
  validateListUsers,
  ValidationError,
  CreateUserInput,
  UpdateUserInput,
  DeleteUserParams,
  ListUsersQuery,
} from './user.validator-effect';
import { UserResponse, UserFilters } from './user.types';

/**
 * Effect-based User API Implementation
 *
 * Key Effect concepts demonstrated:
 * 1. HttpApi definition with typed endpoints
 * 2. HttpApiGroup for organizing related endpoints
 * 3. Integration with Effect-based service layer
 * 4. Structured error handling with custom error types
 * 5. Schema validation using Effect Schema
 * 6. Composable middleware patterns
 */

// Custom error schemas for HTTP responses
export const HttpValidationErrorSchema = Schema.Struct({
  _tag: Schema.Literal('HttpValidationError'),
  message: Schema.String,
  details: Schema.optional(Schema.Unknown)
});

export const HttpUnauthorizedErrorSchema = Schema.Struct({
  _tag: Schema.Literal('HttpUnauthorizedError'),
  message: Schema.String
});

export const HttpForbiddenErrorSchema = Schema.Struct({
  _tag: Schema.Literal('HttpForbiddenError'),
  message: Schema.String
});

export const HttpNotFoundErrorSchema = Schema.Struct({
  _tag: Schema.Literal('HttpNotFoundError'),
  message: Schema.String
});

export const UserConflictErrorSchema = Schema.Struct({
  _tag: Schema.Literal('UserConflictError'),
  message: Schema.String
});

// Error classes for throwing
export class HttpValidationError extends Error {
  readonly _tag = 'HttpValidationError';
  constructor(message: string, readonly details?: unknown) {
    super(message);
  }
}

export class HttpUnauthorizedError extends Error {
  readonly _tag = 'HttpUnauthorizedError';
  constructor(message: string = 'Unauthorized') {
    super(message);
  }
}

export class HttpForbiddenError extends Error {
  readonly _tag = 'HttpForbiddenError';
  constructor(message: string = 'Forbidden') {
    super(message);
  }
}

export class HttpNotFoundError extends Error {
  readonly _tag = 'HttpNotFoundError';
  constructor(message: string = 'Not Found') {
    super(message);
  }
}

// Request/Response schemas using Effect Schema
const UserResponseSchema = Schema.Struct({
  user_id: Schema.String,
  username: Schema.String,
  nickname: Schema.String,
  roles: Schema.Array(Schema.String),
  valid_from: Schema.Date,
  valid_until: Schema.Union(Schema.Date, Schema.Null),
});

const CreateUserResponseSchema = Schema.Struct({
  'user-id': Schema.String,
  username: Schema.String,
});

const UpdateUserResponseSchema = Schema.Struct({
  'user-id': Schema.String,
  username: Schema.String,
});

const UsersListResponseSchema = Schema.Array(UserResponseSchema);

// Path parameters
const usernameParam = HttpApiSchema.param('username', Schema.String);

// Query parameters for list users
const ListUsersQuerySchema = Schema.partial(
  Schema.Struct({
    includeDeleted: Schema.String,
    role: Schema.String,
  }),
);

// Request body schemas
const CreateUserBodySchema = Schema.Struct({
  username: Schema.String,
  password: Schema.String,
  nickname: Schema.String,
  roles: Schema.Array(Schema.String),
});

const UpdateUserBodySchema = Schema.Struct({
  username: Schema.String,
  password: Schema.optional(Schema.String),
  nickname: Schema.String,
  roles: Schema.Array(Schema.String),
});

/**
 * User API Group Definition
 * Defines all user-related endpoints with their schemas
 */
const usersGroup = HttpApiGroup.make('users')
  .add(
    HttpApiEndpoint.get('listUsers')`/`
      .addSuccess(UsersListResponseSchema)
      .addError(HttpUnauthorizedErrorSchema)
      .addError(HttpForbiddenErrorSchema)
  )
  .add(
    HttpApiEndpoint.get('getUser')`/${usernameParam}`
      .addSuccess(UserResponseSchema)
      .addError(HttpUnauthorizedErrorSchema)
      .addError(HttpNotFoundErrorSchema)
  )
  .add(
    HttpApiEndpoint.post('createUser')`/`
      .addSuccess(CreateUserResponseSchema)
      .addError(HttpValidationErrorSchema)
      .addError(HttpUnauthorizedErrorSchema)
      .addError(HttpForbiddenErrorSchema)
      .addError(UserConflictErrorSchema)
  )
  .add(
    HttpApiEndpoint.put('updateUser')`/${usernameParam}`
      .addSuccess(UpdateUserResponseSchema)
      .addError(HttpValidationErrorSchema)
      .addError(HttpUnauthorizedErrorSchema)
      .addError(HttpForbiddenErrorSchema)
      .addError(HttpNotFoundErrorSchema)
  )
  .add(
    HttpApiEndpoint.del('deleteUser')`/${usernameParam}`
      .addSuccess(Schema.Void)
      .addError(HttpUnauthorizedErrorSchema)
      .addError(HttpForbiddenErrorSchema)
      .addError(HttpNotFoundErrorSchema)
  );

/**
 * Complete User API Definition
 */
export const UserApi = HttpApi.make('UserApi').add(usersGroup);

/**
 * Authentication Service Interface
 * Simplified version focusing on the core auth needs
 */
export interface AuthService {
  readonly authenticateToken: (token: string) => Effect.Effect<{ username: string; roles: string[] }, HttpUnauthorizedError>;
  readonly requireRole: (userRoles: string[], requiredRole: string) => Effect.Effect<void, HttpForbiddenError>;
}

export const AuthServiceTag = Context.GenericTag<AuthService>('AuthService');

/**
 * Helper function to extract authorization header
 */
const extractAuthToken = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return yield* Effect.fail(new HttpUnauthorizedError('Missing or invalid authorization header'));
    }
    return authHeader.substring(7); // Remove "Bearer " prefix
  });

/**
 * Authentication middleware effect
 */
const authenticate = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const token = yield* extractAuthToken(request);
    const authService = yield* AuthServiceTag;
    const user = yield* authService.authenticateToken(token);
    return user;
  });

/**
 * Role-based authorization middleware effect
 */
const requireAdminRole = (user: { username: string; roles: string[] }) =>
  Effect.gen(function* () {
    const authService = yield* AuthServiceTag;
    return yield* authService.requireRole(user.roles, 'game.admin');
  });

/**
 * User API Group Implementation
 * Implements all the endpoint handlers with Effect patterns
 */
const usersGroupLive = HttpApiBuilder.group(UserApi, 'users', (handlers) =>
  handlers
    .handle('listUsers', (req) =>
      Effect.gen(function* () {
        // Authentication & Authorization
        const user = yield* authenticate(req.request);
        yield* requireAdminRole(user);

        // For now, use empty query until we can access actual query params
        const validated = yield* validateListUsers({ query: {} }).pipe(
          Effect.mapError((error) => new HttpValidationError('Invalid query parameters', error))
        );

        // Call service
        const userService = yield* UserServiceEffectTag;
        const filters: UserFilters = validated.query || {};
        const users = yield* userService.listUsers(filters).pipe(
          Effect.mapError((error) => new HttpValidationError('Failed to list users', error))
        );

        return users;
      })
    )
    .handle('getUser', ({ path: { username }, request }) =>
      Effect.gen(function* () {
        // Authentication (no admin role required for getting single user)
        yield* authenticate(request);

        // Call service
        const userService = yield* UserServiceEffectTag;
        const user = yield* userService.getUser(username).pipe(
          Effect.mapError((error) => {
            if (error._tag === 'UserNotFoundError') {
              return new HttpNotFoundError(error.message);
            }
            return new HttpValidationError('Failed to get user', error);
          })
        );

        // Transform to response format (remove password_hash)
        const { password_hash, ...userResponse } = user as any;
        return userResponse;
      })
    )
    .handle('createUser', ({ request }) =>
      Effect.gen(function* () {
        // Authentication & Authorization
        const user = yield* authenticate(request);
        yield* requireAdminRole(user);

        // Get request body
        const body = yield* HttpServerRequest.schemaBodyJson(CreateUserBodySchema)(request).pipe(
          Effect.mapError((error) => new HttpValidationError('Invalid request body', error))
        );

        // Validate using Effect validator
        const validated = yield* validateCreateUser({ body }).pipe(
          Effect.mapError((error) => new HttpValidationError('Validation failed', error))
        );

        // Call service
        const userService = yield* UserServiceEffectTag;
        const createdUser = yield* userService.createUser(validated.body).pipe(
          Effect.mapError((error) => {
            if (error._tag === 'UserConflictError') {
              return error; // Pass through UserConflictError
            }
            return new HttpValidationError('Failed to create user', error);
          })
        );

        // Transform to expected response format
        return {
          'user-id': createdUser.user_id,
          username: createdUser.username,
        };
      })
    )
    .handle('updateUser', ({ path: { username }, request }) =>
      Effect.gen(function* () {
        // Authentication & Authorization
        const user = yield* authenticate(request);
        yield* requireAdminRole(user);

        // Get request body
        const body = yield* HttpServerRequest.schemaBodyJson(UpdateUserBodySchema)(request).pipe(
          Effect.mapError((error) => new HttpValidationError('Invalid request body', error))
        );

        // Validate using Effect validator
        const validated = yield* validateUpdateUser({
          params: { username },
          body,
        }).pipe(
          Effect.mapError((error) => new HttpValidationError('Validation failed', error))
        );

        // Call service
        const userService = yield* UserServiceEffectTag;
        const updatedUser = yield* userService.updateUser(username, validated.body).pipe(
          Effect.mapError((error) => {
            if (error._tag === 'UserNotFoundError') {
              return new HttpNotFoundError(error.message);
            }
            return new HttpValidationError('Failed to update user', error);
          })
        );

        // Transform to expected response format
        return {
          'user-id': updatedUser.user_id,
          username: updatedUser.username,
        };
      })
    )
    .handle('deleteUser', ({ path: { username }, request }) =>
      Effect.gen(function* () {
        // Authentication & Authorization
        const user = yield* authenticate(request);
        yield* requireAdminRole(user);

        // Validate using Effect validator
        yield* validateDeleteUser({
          params: { username },
        }).pipe(
          Effect.mapError((error) => new HttpValidationError('Validation failed', error))
        );

        // Call service
        const userService = yield* UserServiceEffectTag;
        yield* userService.deleteUser(username).pipe(
          Effect.mapError((error) => {
            if (error._tag === 'UserNotFoundError') {
              return new HttpNotFoundError(error.message);
            }
            return new HttpValidationError('Failed to delete user', error);
          })
        );

        return undefined; // 204 No Content
      })
    )
);

/**
 * Complete API Implementation Layer
 */
export const UserApiLive = HttpApiBuilder.api(UserApi).pipe(Layer.provide(usersGroupLive));

/**
 * Usage Examples:
 *
 * // Basic API server setup
 * const server = HttpApiBuilder.serve(UserApi).pipe(
 *   Effect.provide(UserApiLive),
 *   Effect.provide(UserServiceEffectLive),
 *   Effect.provide(AuthServiceLive),
 *   Effect.provide(DatabaseLive)
 * );
 *
 * // Run the server
 * const result = await Effect.runPromise(server);
 *
 * // Integration with Express (if needed)
 * const expressHandler = HttpApiBuilder.toExpress(UserApi).pipe(
 *   Effect.provide(UserApiLive),
 *   Effect.provide(UserServiceEffectLive),
 *   Effect.provide(AuthServiceLive)
 * );
 */

/**
 * Comparison with Traditional Express Routes:
 *
 * Traditional Express (user.routes.ts):
 * - Router-based routing with middleware chain
 * - Manual error handling with try/catch
 * - Direct service calls with await
 * - Imperative middleware composition
 * - Manual request/response parsing
 *
 * Effect HttpApi (user.routes-effect.ts):
 * - Declarative API definition with schemas
 * - Structured error handling with typed errors
 * - Functional composition with Effect.gen
 * - Dependency injection for services
 * - Automatic request/response validation
 * - Type-safe endpoint definitions
 * - Reusable for server, docs, and client generation
 * - Built-in middleware patterns with composability
 */