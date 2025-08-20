import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { config } from './config';
import * as schema from './schema';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

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

export const getDb = () => {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
};

export const initializeDatabase = async (): Promise<void> => {
  const database = getDb();
  
  try {
    // In development, use push for instant schema updates
    if (config.nodeEnv === 'development') {
      console.log('Development mode: Using schema push for instant updates...');
      const { execSync } = require('child_process');
      execSync('npx drizzle-kit push', { stdio: 'inherit' });
    } else {
      // In production, use migrations for safety
      console.log('Production mode: Running migrations...');
      await migrate(database, { migrationsFolder: './drizzle' });
    }
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

export { schema };