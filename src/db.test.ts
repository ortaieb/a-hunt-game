import { execSync } from 'child_process';

// Mock child_process for drizzle-kit commands
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock fs for file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true), // Pretend meta/_journal.json exists
  readFileSync: jest.fn(() => '{"entries":[]}'), // Mock journal content
}));

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn(),
    query: jest.fn(),
  })),
}));

// Mock drizzle-orm/node-postgres
jest.mock('drizzle-orm/node-postgres', () => ({
  drizzle: jest.fn().mockReturnValue({
    execute: jest.fn(),
  }),
}));

// Mock drizzle-orm/node-postgres/migrator
jest.mock('drizzle-orm/node-postgres/migrator', () => ({
  migrate: jest.fn().mockResolvedValue(undefined),
}));

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

// Import after mocking
const { initializeDatabase, getPool, closePool } = require('./db');

describe('Database (Drizzle)', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('initializeDatabase', () => {
    beforeEach(() => {
      mockedExecSync.mockClear();
    });

    it('should initialize database successfully', async () => {
      // The actual command execution depends on NODE_ENV, but we just test it doesn't throw
      await expect(initializeDatabase()).resolves.not.toThrow();
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