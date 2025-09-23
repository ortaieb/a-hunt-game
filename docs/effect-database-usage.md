# Official @effect/sql-drizzle Database Usage Guide

## Overview

This guide explains how to use the official `@effect/sql-drizzle` package in the Scavenger Hunt Game server. The official Effect SQL ecosystem provides production-ready functional programming patterns with dependency injection, composable operations, and robust error handling.

## Key Concepts

### 1. Effect Values vs Immediate Execution

Traditional database operations execute immediately:
```typescript
// Traditional approach - executes immediately
const user = await UserModel.findById('123');
```

Effect-based operations create descriptions of computations:
```typescript
// Effect approach - creates a description
const userEffect = UserModelEffect.findById('123');
// Nothing has executed yet - this is just a value describing the operation
```

### 2. Dependency Injection

Effect uses Context tags for dependency injection, making code testable and modular:

```typescript
// Services are injected through Context
const result = Effect.runPromise(
  userEffect.pipe(
    Effect.provide(DatabaseLive),      // Inject database service
    Effect.provide(makeCryptoService()) // Inject crypto service
  )
);
```

### 3. Structured Error Handling

Effect provides type-safe error handling with custom error types:

```typescript
// Custom error types with structured information
export class UserNotFoundError extends Error {
  readonly _tag = 'UserNotFoundError';
}

export class DatabaseError extends Error {
  readonly _tag = 'DatabaseError';
}
```

## Database Service Architecture

### Core Components

1. **PgDrizzle Service** - Official Drizzle service for PostgreSQL
2. **PgClient Layer** - PostgreSQL connection management
3. **Config System** - Environment-based configuration using Effect Config
4. **Layer Architecture** - Official layer composition patterns
5. **Built-in Error Handling** - Automatic SQL error management

### Database Configuration

```typescript
// Official Effect Config system
export const DatabaseConfig = {
  host: Config.string("DB_HOST").pipe(Config.withDefault("localhost")),
  port: Config.integer("DB_PORT").pipe(Config.withDefault(5432)),
  database: Config.string("DB_NAME").pipe(Config.withDefault("scavenger_hunt")),
  user: Config.string("DB_USER").pipe(Config.withDefault("postgres")),
  password: Config.redacted("DB_PASSWORD"),
  ssl: Config.boolean("DB_SSL").pipe(Config.withDefault(false)),
  maxConnections: Config.integer("DB_MAX_CONNECTIONS").pipe(Config.withDefault(20)),
};

// PostgreSQL client layer
export const PgLive = PgClient.layerConfig({
  host: DatabaseConfig.host,
  port: DatabaseConfig.port,
  database: DatabaseConfig.database,
  username: DatabaseConfig.user,
  password: DatabaseConfig.password,
  ssl: DatabaseConfig.ssl,
  maxConnections: DatabaseConfig.maxConnections,
});

// Drizzle layer combining PgClient with Drizzle ORM
export const DrizzleLive = PgDrizzleLayer.pipe(Layer.provide(PgLive));
```

## Usage Patterns

### 1. Basic Database Query

```typescript
import { PgDrizzle } from '../../shared/database/effect-database';
import { users } from '../../schema/users';
import { eq, isNull, and } from 'drizzle-orm';
import { Array } from 'effect';

// Create an Effect that describes a database query using official patterns
const findUserById = (userId: string) =>
  Effect.gen(function* () {
    const drizzle = yield* PgDrizzle;
    const result = yield* drizzle
      .select()
      .from(users)
      .where(and(
        eq(users.user_id, userId),
        isNull(users.valid_until)
      ))
      .limit(1);

    return yield* Array.head(result).pipe(
      Effect.orElse(() => Effect.succeed(null))
    );
  });

// Execute the Effect
const program = Effect.gen(function* () {
  const user = yield* findUserById('user-123');
  return user;
}).pipe(Effect.provide(DatabaseLive));

const result = await Effect.runPromise(program);
```

### 2. Database Transaction

```typescript
import { PgDrizzle } from '../../shared/database/effect-database';
import { users } from '../../schema/users';

// Create an Effect that describes a transaction using official patterns
const createUser = (userData: CreateUserData) =>
  Effect.gen(function* () {
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

    // Official transaction pattern - no nested Effect.gen
    const result = yield* drizzle.insert(users).values(newUser).returning();

    return yield* Array.head(result).pipe(
      Effect.mapError(() => new UserCreationError('Failed to create user'))
    );
  });

// Execute with built-in error handling
const program = Effect.gen(function* () {
  const user = yield* createUser(userData);
  return user;
}).pipe(Effect.provide(DatabaseLive));
```

### 3. Service Composition

```typescript
// Combine multiple services in a single Effect
const authenticateUser = (username: string, password: string) =>
  Effect.gen(function* () {
    // Get dependencies
    const crypto = yield* CryptoService;

    // Find user
    const user = yield* UserModelEffect.findByUsername(username);

    if (!user) {
      return yield* Effect.fail(new UserNotFoundError(username));
    }

    // Verify password
    const isValid = yield* Effect.promise(() =>
      crypto.compare(password, user.password_hash)
    );

    return isValid ? user : null;
  });

// Run with all dependencies
const result = await Effect.runPromise(
  authenticateUser('john.doe', 'password').pipe(
    Effect.provide(DatabaseLive),
    Effect.provide(makeCryptoService())
  )
);
```

## Service Layers

### Database Layer

The database layer uses official @effect/sql-drizzle patterns:

```typescript
// Official layer composition
export const DrizzleLive = PgDrizzleLayer.pipe(Layer.provide(PgLive));
export const DatabaseLive = DrizzleLive;

// Custom configuration using official patterns
const customDbLayer = makeDatabaseLayer({
  host: 'custom-host',
  port: 5433
});
```

### Using Layers

```typescript
// Method 1: Use the default layer
const program = myDatabaseOperation.pipe(
  Effect.provide(DatabaseLive)
);

// Method 2: Use custom configuration
const program = myDatabaseOperation.pipe(
  Effect.provide(customDbLayer)
);

// Method 3: Combine multiple layers
const program = myDatabaseOperation.pipe(
  Effect.provide(DatabaseLive),
  Effect.provide(makeCryptoService())
);
```

## Error Handling

### Built-in SQL Error Handling

```typescript
// @effect/sql-drizzle provides automatic error handling
// Built-in error types include SQL errors, connection errors, etc.

// Using Effect error handling with official patterns
const safeQuery = userQuery.pipe(
  Effect.catchAll(error => {
    console.error('Database operation failed:', error.message);
    return Effect.succeed(null); // Fallback value
  })
);

// Custom error handling for business logic
const findUserSafely = (id: string) =>
  UserModelEffect.findById(id).pipe(
    Effect.mapError(error => {
      if (error instanceof UserNotFoundError) {
        return new UserNotFoundError(`User not found: ${id}`);
      }
      return error;
    })
  );
```

### Error Recovery

```typescript
// Retry with exponential backoff
const resilientQuery = userQuery.pipe(
  Effect.retry({
    schedule: Schedule.exponential('100 millis'),
    times: 3
  }),
  Effect.catchAll(error => {
    console.error('Query failed after retries:', error.message);
    return Effect.succeed(null);
  })
);
```

## Testing

### Mock Services

```typescript
// Create mock database service for testing
const mockDatabaseService = makeDatabaseService({
  host: 'test-host',
  port: 5432,
  database: 'test-db',
  user: 'test-user',
  password: 'test-pass',
});

// Test Effect operations
describe('User Operations', () => {
  it('should find user by ID', async () => {
    const effect = UserModelEffect.findById('test-id');

    // Test the Effect structure first
    expect(effect).toBeDefined();
    expect(typeof effect.pipe).toBe('function');

    // Then test execution with mock dependencies
    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(mockDatabaseService))
    );

    expect(result).toBeDefined();
  });
});
```

### Integration Testing

```typescript
// Test with real database in integration tests
const integrationTest = async () => {
  const result = await Effect.runPromise(
    UserModelEffect.create({
      username: 'test@example.com',
      password: 'securepassword',
      nickname: 'Test User',
      roles: ['user']
    }).pipe(
      Effect.provide(DatabaseLive),
      Effect.provide(makeCryptoService())
    )
  );

  expect(result.username).toBe('test@example.com');
};
```

## Benefits

### 1. Testability

- Easy dependency injection
- Mock services for unit testing
- Deterministic behavior

### 2. Composability

- Operations can be combined and reused
- Functional composition patterns
- Type-safe operation chaining

### 3. Error Safety

- Structured error types
- Compile-time error checking
- Explicit error handling

### 4. Performance

- Lazy evaluation
- Efficient resource management
- Connection pooling

### 5. Maintainability

- Clear separation of concerns
- Dependency injection
- Functional programming patterns

## Best Practices

### 1. Use Official Patterns

```typescript
// Use the official PgDrizzle service pattern
const findUser = (id: string) => Effect.gen(function* () {
  const drizzle = yield* PgDrizzle;
  const result = yield* drizzle
    .select()
    .from(users)
    .where(eq(users.user_id, id))
    .limit(1);

  return yield* Array.head(result).pipe(
    Effect.orElse(() => Effect.succeed(null))
  );
});

// Avoid custom wrapper functions - use official patterns directly
```

### 2. Compose Operations

```typescript
// Build complex operations from simple ones
const updateUserPassword = (userId: string, newPassword: string) =>
  Effect.gen(function* () {
    const crypto = yield* CryptoService;
    const user = yield* UserModelEffect.findById(userId);

    if (!user) {
      return yield* Effect.fail(new UserNotFoundError(userId));
    }

    const hashedPassword = yield* Effect.promise(() =>
      crypto.hash(newPassword)
    );

    return yield* withDatabaseTransaction(tx =>
      tx.update(users)
        .set({ password_hash: hashedPassword })
        .where(eq(users.user_id, userId))
        .returning()
        .then(rows => rows[0])
    );
  });
```

### 3. Handle Errors Appropriately

```typescript
// Use specific error types
const createUserSafely = (userData: CreateUserData) =>
  UserModelEffect.create(userData).pipe(
    Effect.mapError(error => {
      if (error.message.includes('unique constraint')) {
        return new UserCreationError('Username already exists');
      }
      return error;
    })
  );
```

### 4. Use Layers for Configuration

```typescript
// Environment-specific layers
const developmentLayer = makeDatabaseService({
  host: 'localhost',
  database: 'scavenger_hunt_dev'
});

const productionLayer = DatabaseLive;

const databaseLayer = process.env.NODE_ENV === 'production'
  ? productionLayer
  : developmentLayer;
```

## Migration from Traditional Approach

### Before (Traditional)

```typescript
export class UserModel {
  static async findById(userId: string): Promise<User | null> {
    try {
      const result = await db.select()
        .from(users)
        .where(eq(users.user_id, userId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }
}

// Usage
const user = await UserModel.findById('123');
```

### After (Effect)

```typescript
export class UserModelEffect {
  static findById = (userId: string) =>
    withDatabaseQuery(db =>
      db.select()
        .from(users)
        .where(eq(users.user_id, userId))
        .limit(1)
        .then(rows => rows[0] || null)
    );
}

// Usage
const userEffect = UserModelEffect.findById('123');
const user = await Effect.runPromise(
  userEffect.pipe(Effect.provide(DatabaseLive))
);
```

## Conclusion

The Effect-based database implementation provides a powerful, type-safe, and composable approach to database operations. It enables better testing, error handling, and code organization while maintaining performance and reliability.

Key advantages:
- **Type Safety**: Compile-time error checking
- **Testability**: Easy mocking and dependency injection
- **Composability**: Functional composition patterns
- **Error Handling**: Structured, recoverable errors
- **Performance**: Lazy evaluation and efficient resource management

For more information on the Effect library, visit: https://effect.website/