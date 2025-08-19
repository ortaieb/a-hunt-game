// Mock database module for testing
import { PoolClient } from 'pg';

interface MockUser {
  user_id: number;
  username: string;
  password_hash: string;
  nickname: string;
  roles: string[];
  valid_from: Date;
  valid_until: Date | null;
}

// In-memory storage for mock database
let mockUsers: MockUser[] = [];
let nextUserId = 1;

// Mock PoolClient for database operations
class MockPoolClient {
  private released = false;

  async query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> {
    if (this.released) {
      throw new Error('Client has been released');
    }

    // Parse SQL to determine operation
    const normalizedSql = sql.trim().toLowerCase();
    
    if (normalizedSql.includes('create table') || normalizedSql.includes('create index') || normalizedSql.includes('create unique index')) {
      // Mock DDL operations - just return success
      return { rows: [], rowCount: 0 };
    }
    
    if (normalizedSql.includes('begin') || normalizedSql.includes('commit') || normalizedSql.includes('rollback')) {
      // Mock transaction operations
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('delete from users')) {
      // Clear all users (for test cleanup)
      mockUsers = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('insert into users') && normalizedSql.includes('returning')) {
      // Mock user creation with RETURNING clause
      const user: MockUser = {
        user_id: nextUserId++,
        username: (params?.[0] as string) || 'test@example.com',
        password_hash: (params?.[1] as string) || 'hashedpassword',
        nickname: (params?.[2] as string) || 'Test User',
        roles: (params?.[3] as string[]) || ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      // Check for duplicate username (active users only)
      const existingActiveUser = mockUsers.find(u => u.username === user.username && u.valid_until === null);
      if (existingActiveUser) {
        const error = new Error('duplicate key value violates unique constraint');
        (error as unknown as { code: string }).code = '23505'; // PostgreSQL unique violation code
        throw error;
      }

      mockUsers.push(user);
      return { rows: [user], rowCount: 1 };
    }

    if (normalizedSql.includes('select') && normalizedSql.includes('from users')) {
      let filteredUsers = mockUsers;
      
      // Filter by active users (valid_until IS NULL)
      if (normalizedSql.includes('valid_until is null')) {
        filteredUsers = mockUsers.filter(u => u.valid_until === null);
      }
      
      // Filter by username
      if (params && params[0] && normalizedSql.includes('username = $1')) {
        filteredUsers = filteredUsers.filter(u => u.username === (params[0] as string));
      }
      
      // Sort by username if ORDER BY is specified
      if (normalizedSql.includes('order by username')) {
        filteredUsers = filteredUsers.sort((a, b) => a.username.localeCompare(b.username));
      }
      
      return { rows: filteredUsers, rowCount: filteredUsers.length };
    }

    if (normalizedSql.includes('update users') && normalizedSql.includes('set valid_until')) {
      // Mock soft delete (setting valid_until timestamp)
      const username = params?.[0] as string;
      let affectedRows = 0;
      
      for (const user of mockUsers) {
        if (user.username === username && user.valid_until === null) {
          user.valid_until = new Date();
          affectedRows++;
        }
      }
      
      return { rows: [], rowCount: affectedRows };
    }

    // Information schema queries for database structure tests
    if (normalizedSql.includes('information_schema.columns')) {
      const mockColumns = [
        { column_name: 'user_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'username', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'password_hash', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'nickname', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'roles', data_type: 'ARRAY', is_nullable: 'NO' },
        { column_name: 'valid_from', data_type: 'timestamp with time zone', is_nullable: 'NO' },
        { column_name: 'valid_until', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      ];
      return { rows: mockColumns, rowCount: mockColumns.length };
    }

    if (normalizedSql.includes('pg_indexes')) {
      const mockIndexes = [
        { indexname: 'users_pkey' }, // Primary key index
        { indexname: 'idx_users_username_active' },
        { indexname: 'idx_users_temporal' },
      ];
      return { rows: mockIndexes, rowCount: mockIndexes.length };
    }

    // Default fallback
    return { rows: [], rowCount: 0 };
  }

  release(): void {
    this.released = true;
  }
}

// Mock pool
const mockPool = {
  connect: async (): Promise<PoolClient> => {
    return new MockPoolClient() as unknown as PoolClient;
  },
  end: async (): Promise<void> => {
    // Clean up mock data
    mockUsers = [];
    nextUserId = 1;
  },
  query: async (sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number }> => {
    const client = await mockPool.connect();
    try {
      const result = await client.query(sql, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    } finally {
      client.release();
    }
  },
};

let pool: unknown = null;

export const getPool = (): unknown => {
  if (!pool) {
    pool = mockPool;
  }
  return pool;
};

export const getClient = async (): Promise<PoolClient> => {
  return await (getPool() as typeof mockPool).connect();
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await (pool as typeof mockPool).end();
    pool = null;
  }
};

export const initializeDatabase = async (): Promise<void> => {
  // Mock database initialization - just ensure pool is created
  getPool();
};

// Reset function for tests
export const resetMockDatabase = (): void => {
  mockUsers = [];
  nextUserId = 1;
};