import { initializeDatabase, getPool, closePool } from './database';

describe('Database', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('initializeDatabase', () => {
    it('should initialize database tables successfully', async () => {
      await expect(initializeDatabase()).resolves.not.toThrow();
    });

    it('should create users table with correct structure', async () => {
      const pool = getPool();
      
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);

      const expectedColumns = [
        { column_name: 'user_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'username', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'password_hash', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'nickname', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'roles', data_type: 'ARRAY', is_nullable: 'NO' },
        { column_name: 'valid_from', data_type: 'timestamp with time zone', is_nullable: 'NO' },
        { column_name: 'valid_until', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      ];

      expect(result.rows).toEqual(expect.arrayContaining(expectedColumns));
    });

    it('should create required indexes', async () => {
      const pool = getPool();
      
      const indexResult = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'users'
      `);

      const indexNames = indexResult.rows.map(row => row.indexname);
      
      expect(indexNames).toContain('users_pkey'); // Primary key
      expect(indexNames).toContain('idx_users_username_active'); // Unique constraint for active users
      expect(indexNames).toContain('idx_users_temporal'); // Temporal query index
    });
  });

  describe('getPool', () => {
    it('should return a database pool', () => {
      const pool = getPool();
      expect(pool).toBeDefined();
      expect(typeof pool.connect).toBe('function');
    });

    it('should return the same pool instance on multiple calls', () => {
      const pool1 = getPool();
      const pool2 = getPool();
      expect(pool1).toBe(pool2);
    });
  });
});