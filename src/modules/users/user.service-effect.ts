// src/modules/users/user.service-effect.ts
// Effect-based service layer for user operations
// This file demonstrates Effect service patterns based on user.service.ts

import { Effect, Context, pipe, Layer } from 'effect';
import { UserModelEffect, CryptoService } from './user.model-effect';
import { validateCreateUser, validateUpdateUser, ValidationError } from './user.validator-effect';
import { User, UserResponse, UserFilters, CreateUserData, UpdateUserData } from './user.types';
import { PgDrizzle } from '../../shared/database/effect-database';

/**
 * Effect-based User Service
 *
 * Key Effect concepts demonstrated:
 * 1. Service layer with Effect Context.GenericTag
 * 2. Composable service operations using Effect.gen
 * 3. Integration with Effect-based model and validator
 * 4. Structured error handling with Effect patterns
 * 5. Dependency injection for external services
 */

// Custom error types for service layer
export class UserConflictError extends Error {
  readonly _tag = 'UserConflictError';
  constructor(message: string) {
    super(message);
  }
}

export class UserNotFoundError extends Error {
  readonly _tag = 'UserNotFoundError';
  constructor(message: string) {
    super(message);
  }
}

export class UserServiceValidationError extends Error {
  readonly _tag = 'UserServiceValidationError';
  constructor(message: string) {
    super(message);
  }
}

export class UserUnauthorizedError extends Error {
  readonly _tag = 'UserUnauthorizedError';
  constructor(message: string) {
    super(message);
  }
}

// Extract the service type from CryptoService tag
type CryptoServiceType = Context.Tag.Service<typeof CryptoService>;

/**
 * User Service Interface
 *
 * Note: We include the required dependencies (PgDrizzle, CryptoService) in the Effect types
 * This allows proper dependency injection and type safety
 */
export interface UserServiceEffect {
  readonly createUser: (data: unknown) => Effect.Effect<UserResponse, UserConflictError | ValidationError, PgDrizzle | CryptoServiceType>;
  readonly updateUser: (username: string, data: unknown) => Effect.Effect<UserResponse, UserNotFoundError | ValidationError, PgDrizzle | CryptoServiceType>;
  readonly deleteUser: (username: string) => Effect.Effect<void, UserNotFoundError, PgDrizzle>;
  readonly getUser: (username: string) => Effect.Effect<User, UserNotFoundError, PgDrizzle>;
  readonly validateUser: (user: User, password: string) => Effect.Effect<UserResponse, UserNotFoundError | UserUnauthorizedError, CryptoServiceType>;
  readonly listUsers: (filters: UserFilters) => Effect.Effect<UserResponse[], never, PgDrizzle>;
  readonly getUserHistory: (username: string) => Effect.Effect<UserResponse[], UserNotFoundError, PgDrizzle>;
}

/**
 * Service tag for dependency injection
 */
export const UserServiceEffectTag = Context.GenericTag<UserServiceEffect>('UserServiceEffect');

/**
 * Private helper function to transform user for API response (remove password_hash)
 */
const toResponse = (user: User): UserResponse => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...userResponse } = user;
  return userResponse;
};

/**
 * Effect-based User Service Implementation
 */
export class UserServiceEffectImpl implements UserServiceEffect {
  /**
   * Create a new user with validation and conflict checking
   */
  createUser = (data: unknown) =>
    Effect.gen(function* () {
      // Validate input data
      const validated = yield* validateCreateUser(data);

      // Check if user exists (including deleted ones)
      const existingUser = yield* UserModelEffect.findByUsername(validated.body.username).pipe(
        Effect.orElse(() => Effect.succeed(null)),
        Effect.catchAll(() => Effect.succeed(null)) // Convert SQL errors to null for existence check
      );

      if (existingUser) {
        return yield* Effect.fail(new UserConflictError('User already exists'));
      }

      // Create the user with type cast for readonly array
      const createData: CreateUserData = {
        ...validated.body,
        roles: validated.body.roles as string[] // Type cast readonly array to mutable
      };
      const user = yield* UserModelEffect.create(createData).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new UserConflictError(`Failed to create user: ${error.message}`))
        )
      );
      return toResponse(user);
    });

  /**
   * Update an existing user with validation
   */
  updateUser = (username: string, data: unknown) =>
    Effect.gen(function* () {
      // Validate input data
      const validated = yield* validateUpdateUser(data);

      if (username !== validated.body.username) {
        return yield* Effect.fail(new ValidationError('URL username must match body username'));
      }

      // Check if user exists
      const existingUser = yield* UserModelEffect.findByUsername(username).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new UserNotFoundError(`Database error while finding user: ${error.message}`))
        )
      );
      if (!existingUser) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      // Update the user (assuming we have an update method in the model)
      // For now, we'll simulate an update by creating with the new data
      const updatedUser: User = yield* Effect.succeed({
        ...existingUser,
        ...validated.body,
        roles: validated.body.roles as string[], // Type cast readonly array to mutable
        password_hash: validated.body.password
          ? yield* Effect.gen(function* () {
              const crypto = yield* CryptoService;
              return yield* Effect.promise(() => crypto.hash(validated.body.password!));
            })
          : existingUser.password_hash
      });

      return toResponse(updatedUser);
    });

  /**
   * Delete a user (soft delete)
   */
  deleteUser = (username: string) =>
    Effect.gen(function* () {
      // Check if user exists
      const existingUser = yield* UserModelEffect.findByUsername(username).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new UserNotFoundError(`Database error while finding user: ${error.message}`))
        )
      );
      if (!existingUser) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      // Note: Since we don't have a delete method in UserModelEffect yet,
      // we'll return a success Effect for demonstration
      return yield* Effect.succeed(undefined);
    });

  /**
   * Get a user by username
   */
  getUser = (username: string) =>
    Effect.gen(function* () {
      const user = yield* UserModelEffect.findByUsername(username).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new UserNotFoundError(`Database error while finding user: ${error.message}`))
        )
      );
      if (!user) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }
      return user;
    });

  /**
   * Validate user credentials
   */
  validateUser = (user: User, password: string) =>
    Effect.gen(function* () {
      if (!user) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      const crypto = yield* CryptoService;
      const passwordMatch = yield* Effect.promise(() =>
        crypto.compare(password, user.password_hash)
      );

      if (!passwordMatch) {
        return yield* Effect.fail(new UserUnauthorizedError('Invalid credentials'));
      }

      return toResponse(user);
    });

  /**
   * List users with optional filters
   */
  listUsers = (filters: UserFilters) =>
    Effect.gen(function* () {
      // Note: Since we don't have a list method in UserModelEffect yet,
      // we'll return an empty array for demonstration
      const users: User[] = yield* Effect.succeed([]);
      return users.map(user => toResponse(user));
    });

  /**
   * Get user history
   */
  getUserHistory = (username: string) =>
    Effect.gen(function* () {
      // Note: Since we don't have a history method in UserModelEffect yet,
      // we'll simulate by checking if user exists and returning empty history
      const user = yield* UserModelEffect.findByUsername(username).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new UserNotFoundError(`Database error while finding user: ${error.message}`))
        )
      );
      if (!user) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      const history: User[] = yield* Effect.succeed([user]);
      return history.map(user => toResponse(user));
    });
}

/**
 * Service layer factory
 */
export const makeUserServiceEffect = (): UserServiceEffect => new UserServiceEffectImpl();

/**
 * Service layer provider using Effect Layer
 */
export const UserServiceEffectLive = Layer.succeed(
  UserServiceEffectTag,
  makeUserServiceEffect()
);

/**
 * Convenience functions for using the service
 */
export const createUser = (data: unknown) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.createUser(data);
  });

export const updateUser = (username: string, data: unknown) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.updateUser(username, data);
  });

export const deleteUser = (username: string) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.deleteUser(username);
  });

export const getUser = (username: string) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.getUser(username);
  });

export const validateUser = (user: User, password: string) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.validateUser(user, password);
  });

export const listUsers = (filters: UserFilters) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.listUsers(filters);
  });

export const getUserHistory = (username: string) =>
  Effect.gen(function* () {
    const service = yield* UserServiceEffectTag;
    return yield* service.getUserHistory(username);
  });

/**
 * Usage Examples:
 *
 * // Basic service operation
 * const createUserProgram = createUser({
 *   username: 'john@example.com',
 *   password: 'securepass',
 *   nickname: 'John',
 *   roles: ['user']
 * });
 *
 * // Run with dependencies
 * const result = await Effect.runPromise(
 *   createUserProgram.pipe(
 *     Effect.provide(UserServiceEffectLive),
 *     Effect.provide(DatabaseLive),
 *     Effect.provide(CryptoServiceLive)
 *   )
 * );
 *
 * // Compose multiple operations
 * const userManagementFlow = Effect.gen(function* () {
 *   const user = yield* createUser(userData);
 *   const validated = yield* validateUser(user, password);
 *   return validated;
 * });
 *
 * // Error handling
 * const safeCreateUser = createUser(userData).pipe(
 *   Effect.catchAll(error => {
 *     if (error._tag === 'UserConflictError') {
 *       return Effect.succeed({ error: 'User already exists' });
 *     }
 *     return Effect.fail(error);
 *   })
 * );
 */

/**
 * Comparison with Traditional Service:
 *
 * Traditional (user.service.ts):
 * - Class-based service with async methods
 * - Direct database calls with await
 * - Error handling with try/catch and throw
 * - Immediate execution
 *
 * Effect (user.service-effect.ts):
 * - Service interface with Effect return types
 * - Dependency injection through Context
 * - Structured error handling with typed errors
 * - Deferred execution with Effect.runPromise
 * - Composable operations using Effect.gen
 * - Integration with Effect ecosystem (model, validator, database)
 */