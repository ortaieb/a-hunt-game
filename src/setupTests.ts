// Test setup for database testing
// import { config } from './config'; // Imported for potential future use

// Use test environment variables if available
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}

// Override database config for testing
process.env.DB_NAME = 'test_scavenger_hunt';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

// Mock the database module to avoid requiring real PostgreSQL connection
jest.mock('./db');

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test timeout
jest.setTimeout(30000);
