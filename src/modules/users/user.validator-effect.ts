// src/modules/users/user.validator-effect.ts
// Effect-based schema validation for user operations
// This file demonstrates Effect schema validation patterns similar to user.validator.ts

import { Schema, Effect } from 'effect';

/**
 * Effect Schema validation for user operations
 *
 * Key Effect Schema concepts demonstrated:
 * 1. Schema definition using Schema.Struct, Schema.String, etc.
 * 2. Custom validation with Schema.filter and Schema.transform
 * 3. Effect-based validation with proper error handling
 * 4. Type inference from schemas
 * 5. Composable schema patterns
 */

// Reusable schema components
const passwordSchema = Schema.String.pipe(
  Schema.minLength(8),
  Schema.filter(password => /[a-zA-Z]/.test(password), {
    message: () => 'Password must contain at least one letter',
  }),
  Schema.filter(password => /\d/.test(password), {
    message: () => 'Password must contain at least one number',
  }),
);

export const emailSchema = Schema.String.pipe(
  Schema.filter(
    email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    },
    {
      message: () => 'Must be a valid email address',
    },
  ),
  Schema.transform(Schema.String, {
    strict: true,
    decode: email => email.toLowerCase().trim(),
    encode: email => email,
  }),
);

const rolesSchema = Schema.Array(Schema.Literal('game.admin', 'game.player', 'viewer')).pipe(
  Schema.minItems(1, {
    message: () => 'At least one role is required',
  }),
);

const nicknameSchema = Schema.String.pipe(
  Schema.transform(Schema.String, {
    strict: true,
    decode: nickname => nickname.trim(),
    encode: nickname => nickname,
  }),
  Schema.minLength(1, {
    message: () => 'Nickname is required',
  }),
);

// Request validation schemas using Effect Schema patterns
export const createUserSchema = Schema.Struct({
  body: Schema.Struct({
    username: emailSchema,
    password: passwordSchema,
    nickname: nicknameSchema,
    roles: rolesSchema,
  }),
});

export const updateUserSchema = Schema.Struct({
  params: Schema.Struct({
    username: emailSchema,
  }),
  body: Schema.Struct({
    username: emailSchema,
    password: Schema.optional(passwordSchema),
    nickname: nicknameSchema,
    roles: rolesSchema,
  }),
});

export const deleteUserSchema = Schema.Struct({
  params: Schema.Struct({
    username: emailSchema,
  }),
});

export const listUsersSchema = Schema.Struct({
  query: Schema.optional(
    Schema.Struct({
      includeDeleted: Schema.optional(
        Schema.String.pipe(
          Schema.transform(Schema.Boolean, {
            strict: true,
            decode: str => str === 'true',
            encode: bool => bool.toString(),
          }),
        ),
      ),
      role: Schema.optional(Schema.String),
    }),
  ),
});

// Export inferred types from Effect schemas
export type CreateUserInput = Schema.Schema.Type<typeof createUserSchema>['body'];
export type UpdateUserInput = Schema.Schema.Type<typeof updateUserSchema>['body'];
export type DeleteUserParams = Schema.Schema.Type<typeof deleteUserSchema>['params'];
export type ListUsersQuery = Schema.Schema.Type<typeof listUsersSchema>['query'];

/**
 * Effect-based validation functions
 * These functions return Effects that can be composed with other operations
 */

export const validateCreateUser = (input: unknown) =>
  Schema.decodeUnknown(createUserSchema)(input).pipe(
    Effect.mapError(error => new ValidationError('Create user validation failed', error)),
  );

export const validateUpdateUser = (input: unknown) =>
  Schema.decodeUnknown(updateUserSchema)(input).pipe(
    Effect.mapError(error => new ValidationError('Update user validation failed', error)),
  );

export const validateDeleteUser = (input: unknown) =>
  Schema.decodeUnknown(deleteUserSchema)(input).pipe(
    Effect.mapError(error => new ValidationError('Delete user validation failed', error)),
  );

export const validateListUsers = (input: unknown) =>
  Schema.decodeUnknown(listUsersSchema)(input).pipe(
    Effect.mapError(error => new ValidationError('List users validation failed', error)),
  );

/**
 * Custom error type for Effect-based validation
 */
export class ValidationError extends Error {
  readonly _tag = 'ValidationError';
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Utility function to validate individual fields
 * Useful for partial validation or form field validation
 */
export const validateEmail = (email: unknown) =>
  Schema.decodeUnknown(emailSchema)(email).pipe(
    Effect.mapError(error => new ValidationError('Email validation failed', error)),
  );

export const validatePassword = (password: unknown) =>
  Schema.decodeUnknown(passwordSchema)(password).pipe(
    Effect.mapError(error => new ValidationError('Password validation failed', error)),
  );

export const validateRoles = (roles: unknown) =>
  Schema.decodeUnknown(rolesSchema)(roles).pipe(
    Effect.mapError(error => new ValidationError('Roles validation failed', error)),
  );

/**
 * Usage Examples:
 *
 * // Basic validation with Effect
 * const validateUserData = (input: unknown) =>
 *   Effect.gen(function* () {
 *     const validated = yield* validateCreateUser(input);
 *     return validated.body;
 *   });
 *
 * // Run validation
 * const result = await Effect.runPromise(validateUserData(userInput));
 *
 * // Compose with other operations
 * const createUserFlow = (input: unknown) =>
 *   Effect.gen(function* () {
 *     const validated = yield* validateCreateUser(input);
 *     const user = yield* UserModelEffect.create(validated.body);
 *     return user;
 *   });
 *
 * // Error handling
 * const safeValidation = validateCreateUser(input).pipe(
 *   Effect.catchAll(error => {
 *     console.error('Validation failed:', error.message);
 *     return Effect.succeed(null);
 *   })
 * );
 */

/**
 * Comparison with Traditional Zod Approach:
 *
 * Traditional Zod (user.validator.ts):
 * - Uses z.object(), z.string(), z.email(), etc.
 * - Validation throws exceptions or returns parsed data
 * - Error handling with try/catch
 * - Immediate execution
 *
 * Effect Schema (user.validator-effect.ts):
 * - Uses Schema.Struct, Schema.String, Schema.filter, etc.
 * - Returns Effect values that describe validation
 * - Structured error handling with ValidationError
 * - Deferred execution with Effect.runPromise
 * - Composable with other Effect operations
 * - Better integration with Effect ecosystem
 */
