// src/shared/database/effect-database.ts
// Effect-based database service for PostgreSQL with Drizzle ORM

import { Effect, Context, Layer } from 'effect';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import * as schema from '../../schema';

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
}

/**
 * Effect database service interface
 */
export interface EffectDatabase {
  readonly client: NodePgDatabase<typeof schema>;
  readonly pool: PgPool;
  readonly query: <T>(operation: (db: NodePgDatabase<typeof schema>) => Promise<T>) => Effect.Effect<T, QueryError>;
  readonly transaction: <T>(
    operation: (tx: NodePgDatabase<typeof schema>) => Promise<T>
  ) => Effect.Effect<T, TransactionError>;
  readonly close: () => Effect.Effect<void, DatabaseError>;
  readonly healthCheck: () => Effect.Effect<boolean, DatabaseError>;
}

/**
 * Database error types
 */
export class DatabaseError extends Error {
  readonly _tag = 'DatabaseError';
  constructor(
    message: string,
    readonly cause?: Error,
    readonly code?: string
  ) {
    super(message);
  }
}

export class ConnectionError extends Error {
  readonly _tag = 'ConnectionError';
  constructor(message: string, readonly cause?: Error) {
    super(`Connection failed: ${message}`);
  }
}

export class QueryError extends Error {
  readonly _tag = 'QueryError';
  constructor(message: string, readonly cause?: Error) {
    super(`Query failed: ${message}`);
  }
}

export class TransactionError extends Error {
  readonly _tag = 'TransactionError';
  constructor(message: string, readonly cause?: Error) {
    super(`Transaction failed: ${message}`);
  }
}

/**
 * Database service tag for dependency injection
 */
export const EffectDatabaseService = Context.GenericTag<EffectDatabase>('EffectDatabaseService');

/**
 * Database configuration tag
 */
export const DatabaseConfigService = Context.GenericTag<DatabaseConfig>('DatabaseConfigService');

/**
 * Create database configuration from environment variables
 */
export const makeDatabaseConfig = (): DatabaseConfig => ({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'scavenger_hunt',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true',
  max: Number(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT) || 2000,
});

/**
 * Create PostgreSQL pool with configuration
 */
const createPool = (config: DatabaseConfig): Effect.Effect<PgPool, ConnectionError> =>
  Effect.gen(function* () {
    try {
      const pool = new PgPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      });

      // Test the connection
      yield* Effect.promise(() =>
        pool.connect().then(client => {
          client.release();
          return pool;
        })
      ).pipe(
        Effect.mapError(error => new ConnectionError('Failed to establish database connection', error))
      );

      return pool;
    } catch (error) {
      return yield* Effect.fail(
        new ConnectionError('Failed to create database pool', error instanceof Error ? error : new Error(String(error)))
      );
    }
  });

/**
 * Create Effect database service implementation
 */
const makeEffectDatabase = (pool: PgPool): EffectDatabase => {
  const client = drizzle(pool, { schema });

  return {
    client,
    pool,

    query: <T>(operation: (db: NodePgDatabase<typeof schema>) => Promise<T>) =>
      Effect.gen(function* () {
        try {
          return yield* Effect.promise(() => operation(client)).pipe(
            Effect.mapError(error => new QueryError('Database query failed', error as Error))
          );
        } catch (error) {
          return yield* Effect.fail(
            new QueryError('Query execution failed', error instanceof Error ? error : new Error(String(error)))
          );
        }
      }),

    transaction: <T>(operation: (tx: NodePgDatabase<typeof schema>) => Promise<T>) =>
      Effect.gen(function* () {
        try {
          return yield* Effect.promise(() =>
            client.transaction(async (tx) => operation(tx))
          ).pipe(
            Effect.mapError(error => new TransactionError('Transaction failed', error as Error))
          );
        } catch (error) {
          return yield* Effect.fail(
            new TransactionError('Transaction execution failed', error instanceof Error ? error : new Error(String(error)))
          );
        }
      }),

    close: () =>
      Effect.gen(function* () {
        try {
          yield* Effect.promise(() => pool.end()).pipe(
            Effect.mapError(error => new DatabaseError('Failed to close database pool', error as Error))
          );
        } catch (error) {
          return yield* Effect.fail(
            new DatabaseError('Pool closure failed', error instanceof Error ? error : new Error(String(error)))
          );
        }
      }),

    healthCheck: () =>
      Effect.gen(function* () {
        try {
          yield* Effect.promise(() =>
            pool.query('SELECT 1').then(() => true)
          ).pipe(
            Effect.mapError(() => new DatabaseError('Health check failed'))
          );
          return true;
        } catch (error) {
          return yield* Effect.fail(
            new DatabaseError('Health check execution failed', error instanceof Error ? error : new Error(String(error)))
          );
        }
      }),
  };
};

/**
 * Layer that provides the database service
 */
export const EffectDatabaseLive = Layer.effect(
  EffectDatabaseService,
  Effect.gen(function* () {
    const config = yield* DatabaseConfigService;
    const pool = yield* createPool(config);
    return makeEffectDatabase(pool);
  })
);

/**
 * Layer that provides database configuration
 */
export const DatabaseConfigLive = Layer.succeed(
  DatabaseConfigService,
  makeDatabaseConfig()
);

/**
 * Complete database layer (config + service)
 */
export const DatabaseLive = DatabaseConfigLive.pipe(
  Layer.provide(EffectDatabaseLive)
);

/**
 * Convenience function to create database service with default config
 */
export const makeDatabaseService = (
  customConfig?: Partial<DatabaseConfig>
): Layer.Layer<EffectDatabase, ConnectionError> =>
  Layer.effect(
    EffectDatabaseService,
    Effect.gen(function* () {
      const defaultConfig = makeDatabaseConfig();
      const config = { ...defaultConfig, ...customConfig };
      const pool = yield* createPool(config);
      return makeEffectDatabase(pool);
    })
  );

/**
 * Usage helper functions
 */
export const withDatabase = <A, E>(
  operation: (db: EffectDatabase) => Effect.Effect<A, E>
) =>
  Effect.gen(function* () {
    const database = yield* EffectDatabaseService;
    return yield* operation(database);
  });

export const withDatabaseQuery = <A>(
  operation: (db: NodePgDatabase<typeof schema>) => Promise<A>
) =>
  Effect.gen(function* () {
    const database = yield* EffectDatabaseService;
    return yield* database.query(operation);
  });

export const withDatabaseTransaction = <A>(
  operation: (tx: NodePgDatabase<typeof schema>) => Promise<A>
) =>
  Effect.gen(function* () {
    const database = yield* EffectDatabaseService;
    return yield* database.transaction(operation);
  });

/**
 * Export types for use in other modules
 */
export type { NodePgDatabase };
export { schema };

/**
 * Usage Examples:
 *
 * // Basic usage with Layer
 * const program = Effect.gen(function* () {
 *   const result = yield* withDatabaseQuery(db =>
 *     db.select().from(users).limit(10)
 *   );
 *   return result;
 * }).pipe(Effect.provide(DatabaseLive));
 *
 * // Transaction usage
 * const transactionProgram = Effect.gen(function* () {
 *   const result = yield* withDatabaseTransaction(tx =>
 *     tx.insert(users).values({ ... }).returning()
 *   );
 *   return result;
 * }).pipe(Effect.provide(DatabaseLive));
 *
 * // Custom configuration
 * const customDbLayer = makeDatabaseService({
 *   host: 'custom-host',
 *   port: 5433
 * });
 *
 * const programWithCustomDb = myDatabaseOperation.pipe(
 *   Effect.provide(customDbLayer)
 * );
 */