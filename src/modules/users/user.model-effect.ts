// src/modules/users/user.model-effect.ts
// Official @effect/sql-drizzle implementation for user.model.ts
// This file demonstrates Effect concepts using the official Effect SQL ecosystem

import { Effect, Context, pipe, Array } from 'effect';
import { eq, isNull, and, desc, sql } from 'drizzle-orm';
import { users, User as DbUser } from '../../schema/users';
import { User, CreateUserData, UpdateUserData, UserFilters } from './user.types';
import { v7 as uuidv7 } from 'uuid';
import { PgDrizzle, DatabaseLive, makeDatabaseLayer } from '../../shared/database/effect-database';

/**
 * Effect-based User Model Implementation
 *
 * Key Effect concepts demonstrated:
 * 1. Dependency Injection via Context.GenericTag
 * 2. Composable operations using Effect.gen
 * 3. Structured error handling with custom error types
 * 4. Service layer pattern with Effect.provide
 * 5. Functional composition over imperative execution
 */

// Service tags for dependency injection
export const CryptoService = Context.GenericTag<{
  readonly hash: (password: string) => Promise<string>;
  readonly compare: (password: string, hash: string) => Promise<boolean>;
}>('CryptoService');

// Custom error types for structured error handling
export class UserNotFoundError extends Error {
  readonly _tag = 'UserNotFoundError';
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
  }
}

export class UserCreationError extends Error {
  readonly _tag = 'UserCreationError';
  constructor(message: string) {
    super(`Failed to create user: ${message}`);
  }
}

/**
 * Effect-based User Operations
 *
 * Each method returns an Effect that describes the computation
 * rather than executing it immediately. This allows for:
 * - Dependency injection
 * - Composability
 * - Better testing
 * - Structured error handling
 */
export class UserModelEffect {
  /**
   * Find user by ID using official @effect/sql-drizzle patterns
   * Demonstrates: dependency injection, error handling, optional results
   */
  static findById = (userId: string) =>
    Effect.gen(function* () {
      const drizzle = yield* PgDrizzle;
      const result = yield* drizzle
        .select()
        .from(users)
        .where(and(eq(users.user_id, userId), isNull(users.valid_until)))
        .limit(1);

      return yield* Array.head(result).pipe(Effect.orElse(() => Effect.succeed(null)));
    });

  /**
   * Create user with dependency injection for database and crypto services
   * Demonstrates: service composition, error propagation, transaction patterns
   */
  static create = (userData: CreateUserData) =>
    Effect.gen(function* () {
      const crypto = yield* CryptoService;

      // Hash password using injected crypto service
      const hashedPassword = yield* Effect.promise(() => crypto.hash(userData.password));

      // Create user using official Drizzle transaction
      const drizzle = yield* PgDrizzle;

      const newUser = {
        user_id: uuidv7(),
        username: userData.username.toLowerCase(),
        password_hash: hashedPassword,
        nickname: userData.nickname,
        roles: userData.roles,
        valid_from: new Date(),
        valid_until: null,
      };

      const result = yield* drizzle.insert(users).values(newUser).returning();

      return yield* Array.head(result).pipe(
        Effect.mapError(() => new UserCreationError('Failed to create user')),
      );
    });

  /**
   * Verify password using composed services
   * Demonstrates: service composition, early returns, boolean operations
   */
  static verifyPassword = (username: string, password: string) =>
    Effect.gen(function* () {
      // Find user first
      const user = yield* UserModelEffect.findByUsername(username);

      if (!user) {
        return false;
      }

      // Verify password using crypto service
      const crypto = yield* CryptoService;
      const isValid = yield* Effect.promise(() =>
        crypto.compare(password, (user as any).password_hash),
      );

      return isValid;
    });

  /**
   * Find user by username
   * Demonstrates: basic Effect pattern with service injection
   */
  static findByUsername = (username: string) =>
    Effect.gen(function* () {
      const drizzle = yield* PgDrizzle;
      const result = yield* drizzle
        .select()
        .from(users)
        .where(and(eq(users.username, username.toLowerCase()), isNull(users.valid_until)))
        .limit(1);

      return yield* Array.head(result).pipe(Effect.orElse(() => Effect.succeed(null)));
    });
}

/**
 * Service Implementations
 * These create the actual service instances that get injected
 */
export const makeCryptoService = () =>
  CryptoService.of({
    hash: async (password: string) => {
      const bcrypt = await import('bcrypt');
      return bcrypt.hash(password, 12);
    },
    compare: async (password: string, hash: string) => {
      const bcrypt = await import('bcrypt');
      return bcrypt.compare(password, hash);
    },
  });

/**
 * Usage Example:
 *
 * const createUserProgram = UserModelEffect.create({
 *   username: 'john.doe',
 *   password: 'securePassword',
 *   nickname: 'John',
 *   roles: ['user']
 * });
 *
 * // Run with dependency injection
 * const result = await Effect.runPromise(
 *   createUserProgram.pipe(
 *     Effect.provide(DatabaseLive),
 *     Effect.provide(makeCryptoService())
 *   )
 * );
 *
 * Key Benefits of Effect Approach:
 * 1. **Testability**: Easy to mock services for testing
 * 2. **Composability**: Operations can be combined and reused
 * 3. **Error Handling**: Structured, type-safe error management
 * 4. **Dependency Injection**: Clean separation of concerns
 * 5. **Functional Style**: Declarative rather than imperative
 * 6. **Type Safety**: Full TypeScript support with inference
 */

/**
 * Comparison with Traditional Approach:
 *
 * Traditional (user.model.ts):
 * - Direct database calls with await
 * - Static methods with hardcoded dependencies
 * - Error handling with try/catch
 * - Immediate execution
 *
 * Effect with @effect/sql-drizzle (user.model-effect.ts):
 * - Uses official Effect SQL ecosystem
 * - Describes computations as Effect values
 * - Dependency injection through Context
 * - Built-in SQL error handling and connection management
 * - Deferred execution with Effect.runPromise
 * - Composable and testable operations
 * - Production-ready with official support
 */
