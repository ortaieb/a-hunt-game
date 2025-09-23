// src/shared/database/effect-database.ts
// Official @effect/sql-drizzle implementation for PostgreSQL with Drizzle ORM

import { Config, Layer } from 'effect';
import { PgClient } from '@effect/sql-pg';
import { PgDrizzle, layer as PgDrizzleLayer } from '@effect/sql-drizzle/Pg';
import * as schema from '../../schema';

/**
 * Database configuration using Effect Config system
 */
export const DatabaseConfig = {
  host: Config.string('DB_HOST').pipe(Config.withDefault('localhost')),
  port: Config.integer('DB_PORT').pipe(Config.withDefault(5432)),
  database: Config.string('DB_NAME').pipe(Config.withDefault('scavenger_hunt')),
  user: Config.string('DB_USER').pipe(Config.withDefault('postgres')),
  password: Config.redacted('DB_PASSWORD'),
  ssl: Config.boolean('DB_SSL').pipe(Config.withDefault(false)),
  maxConnections: Config.integer('DB_MAX_CONNECTIONS').pipe(Config.withDefault(20)),
  idleTimeoutMillis: Config.integer('DB_IDLE_TIMEOUT').pipe(Config.withDefault(30000)),
  connectionTimeoutMillis: Config.integer('DB_CONNECTION_TIMEOUT').pipe(Config.withDefault(2000)),
};

/**
 * PostgreSQL client layer with configuration
 */
export const PgLive = PgClient.layerConfig({
  host: DatabaseConfig.host,
  port: DatabaseConfig.port,
  database: DatabaseConfig.database,
  username: DatabaseConfig.user,
  password: DatabaseConfig.password,
  ssl: DatabaseConfig.ssl,
  maxConnections: DatabaseConfig.maxConnections,
});

/**
 * Drizzle layer that provides the main database service
 * This combines the PostgreSQL client with Drizzle ORM
 */
export const DrizzleLive = PgDrizzleLayer.pipe(Layer.provide(PgLive));

/**
 * Complete database layer that can be used throughout the application
 */
export const DatabaseLive = DrizzleLive;

/**
 * Re-export the Drizzle service type for use in other modules
 */
export { PgDrizzle };

/**
 * Convenience function to create a custom database layer with specific configuration
 */
export const makeDatabaseLayer = (config: {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}) => {
  const customPgLayer = PgClient.layerConfig({
    host: Config.succeed(config.host ?? 'localhost'),
    port: Config.succeed(config.port ?? 5432),
    database: Config.succeed(config.database ?? 'scavenger_hunt'),
    username: Config.succeed(config.user ?? 'postgres'),
    password: Config.redacted(config.password ?? ''),
    ssl: Config.succeed(config.ssl ?? false),
    maxConnections: Config.succeed(config.maxConnections ?? 20),
  });

  return PgDrizzleLayer.pipe(Layer.provide(customPgLayer));
};

/**
 * Export types and schema for use in other modules
 */
export { schema };

/**
 * Usage Example:
 *
 * // Basic usage with the default layer
 * const program = Effect.gen(function* () {
 *   const drizzle = yield* PgDrizzle;
 *   const users = yield* drizzle
 *     .select()
 *     .from(schema.users)
 *     .limit(10);
 *   return users;
 * }).pipe(Effect.provide(DatabaseLive));
 *
 * // Transaction usage
 * const transactionProgram = Effect.gen(function* () {
 *   const drizzle = yield* PgDrizzle;
 *   const result = yield* drizzle.transaction((tx) =>
 *     tx.insert(schema.users).values({ ... }).returning()
 *   );
 *   return result;
 * }).pipe(Effect.provide(DatabaseLive));
 *
 * // Custom configuration
 * const customDbLayer = makeDatabaseLayer({
 *   host: 'custom-host',
 *   port: 5433
 * });
 *
 * const programWithCustomDb = myDatabaseOperation.pipe(
 *   Effect.provide(customDbLayer)
 * );
 */
