import { Pool, PoolClient } from 'pg';
import { config } from './config';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
};

export const getClient = async (): Promise<PoolClient> => {
  return await getPool().connect();
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const initializeDatabase = async (): Promise<void> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Create users table with temporal pattern
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(255) NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{}',
        valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL
      )
    `);

    // Create unique index for active records (temporal constraint)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active 
      ON users (username) 
      WHERE valid_until IS NULL
    `);

    // Create index for temporal queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_temporal 
      ON users (username, valid_from, valid_until)
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};