// src/modules/users/user.routes-effect-simple.test.ts
// Tests for simplified Effect-based user routes

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Effect, Context, Layer } from 'effect';
import {
  listUsersEffect,
  getUserEffect,
  createUserEffect,
  updateUserEffect,
  deleteUserEffect,
  AuthEffectService,
  AuthEffectServiceTag,
  extractAndValidateToken,
  requireAdminRole,
  runEffectRoute,
  EffectHttpError,
  EffectUnauthorizedError,
  EffectForbiddenError,
  EffectNotFoundError,
  EffectValidationError,
  EffectConflictError,
} from './user.routes-effect-simple';
import {
  UserServiceEffectTag,
  UserServiceEffect,
  UserConflictError,
  UserNotFoundError,
} from './user.service-effect';
import { UserResponse, User, UserFilters } from './user.types';

/**
 * Mock implementations for testing
 */

// Mock User Service Implementation
class MockUserService implements UserServiceEffect {
  private users: UserResponse[] = [
    {
      user_id: '1',
      username: 'test@example.com',
      nickname: 'Test User',
      roles: ['user'],
      valid_from: new Date('2023-01-01'),
      valid_until: null,
    },
    {
      user_id: '2',
      username: 'admin@example.com',
      nickname: 'Admin User',
      roles: ['game.admin'],
      valid_from: new Date('2023-01-01'),
      valid_until: null,
    },
  ];

  createUser = (data: unknown) => {
    const self = this;
    return Effect.gen(function* () {
      const userData = data as any;

      // Simulate conflict check
      if (userData.username === 'existing@example.com') {
        return yield* Effect.fail(new UserConflictError('User already exists'));
      }

      // Simulate creation
      const newUser: UserResponse = {
        user_id: 'new-id',
        username: userData.username,
        nickname: userData.nickname,
        roles: userData.roles,
        valid_from: new Date(),
        valid_until: null,
      };

      self.users.push(newUser);
      return newUser;
    });
  };

  updateUser = (username: string, data: unknown) => {
    const self = this;
    return Effect.gen(function* () {
      const userData = data as any;
      const userIndex = self.users.findIndex((u: any) => u.username === username);

      if (userIndex === -1) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      // Update user
      self.users[userIndex] = {
        ...self.users[userIndex],
        ...userData,
      };

      return self.users[userIndex];
    });
  };

  deleteUser = (username: string) => {
    const self = this;
    return Effect.gen(function* () {
      const userIndex = self.users.findIndex((u: any) => u.username === username);

      if (userIndex === -1) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      // Remove user
      self.users.splice(userIndex, 1);
      return undefined;
    });
  };

  getUser = (username: string) => {
    const self = this;
    return Effect.gen(function* () {
      const user = self.users.find((u: any) => u.username === username);

      if (!user) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      // Return with password_hash for internal use
      return {
        ...user,
        password_hash: 'hashed-password',
      } as User;
    });
  };

  validateUser = (user: User, password: string) =>
    Effect.gen(function* () {
      if (password === 'wrong-password') {
        return yield* Effect.fail(new UserNotFoundError('Invalid credentials'));
      }

      const { password_hash, ...userResponse } = user;
      return userResponse;
    });

  listUsers = (filters: UserFilters) => {
    const self = this;
    return Effect.gen(function* () {
      let filteredUsers = [...self.users];

      // Apply filters if provided
      if (filters.role) {
        filteredUsers = filteredUsers.filter((user: any) =>
          user.roles.includes(filters.role!)
        );
      }

      return filteredUsers;
    });
  };

  getUserHistory = (username: string) => {
    const self = this;
    return Effect.gen(function* () {
      const user = self.users.find((u: any) => u.username === username);

      if (!user) {
        return yield* Effect.fail(new UserNotFoundError('User not found'));
      }

      return [user];
    });
  };
}

// Mock Auth Service Implementation
class MockAuthService implements AuthEffectService {
  authenticateToken = (token: string) =>
    Effect.gen(function* () {
      if (token === 'invalid-token') {
        return yield* Effect.fail(new EffectUnauthorizedError('Invalid token'));
      }

      if (token === 'user-token') {
        return {
          username: 'test@example.com',
          roles: ['user'],
        };
      }

      if (token === 'admin-token') {
        return {
          username: 'admin@example.com',
          roles: ['game.admin'],
        };
      }

      return yield* Effect.fail(new EffectUnauthorizedError('Invalid token'));
    });

  requireRole = (userRoles: string[], requiredRole: string) =>
    Effect.gen(function* () {
      if (!userRoles.includes(requiredRole)) {
        return yield* Effect.fail(new EffectForbiddenError('Insufficient permissions'));
      }

      return undefined;
    });
}

// Test Layers
const MockUserServiceLive = Layer.succeed(UserServiceEffectTag, new MockUserService());
const MockAuthServiceLive = Layer.succeed(AuthEffectServiceTag, new MockAuthService());

const TestDependencies = Layer.mergeAll(MockUserServiceLive, MockAuthServiceLive);

describe('Simplified Effect-based User Routes', () => {
  describe('Error Classes', () => {
    it('should create EffectHttpError with status code', () => {
      const error = new EffectHttpError('Test error', 500, { detail: 'test' });
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ detail: 'test' });
    });

    it('should create validation error with 400 status', () => {
      const error = new EffectValidationError('Validation failed', { field: 'username' });
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'username' });
    });

    it('should create unauthorized error with 401 status', () => {
      const error = new EffectUnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('should create forbidden error with 403 status', () => {
      const error = new EffectForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });

    it('should create not found error with 404 status', () => {
      const error = new EffectNotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
    });

    it('should create conflict error with 409 status', () => {
      const error = new EffectConflictError('User already exists');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('User already exists');
    });
  });

  describe('Authentication Helpers', () => {
    it('should extract and validate token successfully', async () => {
      const result = await Effect.runPromise(
        extractAndValidateToken('Bearer admin-token').pipe(
          Effect.provide(MockAuthServiceLive)
        )
      );

      expect(result).toEqual({
        username: 'admin@example.com',
        roles: ['game.admin'],
      });
    });

    it('should reject missing authorization header', async () => {
      await expect(
        Effect.runPromise(
          extractAndValidateToken().pipe(
            Effect.provide(MockAuthServiceLive)
          )
        )
      ).rejects.toThrow('Missing or invalid authorization header');
    });

    it('should reject invalid token format', async () => {
      await expect(
        Effect.runPromise(
          extractAndValidateToken('invalid-format').pipe(
            Effect.provide(MockAuthServiceLive)
          )
        )
      ).rejects.toThrow('Missing or invalid authorization header');
    });

    it('should reject invalid token', async () => {
      await expect(
        Effect.runPromise(
          extractAndValidateToken('Bearer invalid-token').pipe(
            Effect.provide(MockAuthServiceLive)
          )
        )
      ).rejects.toThrow('Invalid token');
    });

    it('should require admin role successfully', async () => {
      const user = { username: 'admin@example.com', roles: ['game.admin'] };

      const result = await Effect.runPromise(
        requireAdminRole(user).pipe(
          Effect.provide(MockAuthServiceLive)
        )
      );

      expect(result).toBeUndefined();
    });

    it('should reject insufficient permissions', async () => {
      const user = { username: 'test@example.com', roles: ['user'] };

      await expect(
        Effect.runPromise(
          requireAdminRole(user).pipe(
            Effect.provide(MockAuthServiceLive)
          )
        )
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('User Operations', () => {
    it('should list users with admin token', async () => {
      const result = await Effect.runPromise(
        listUsersEffect({}, 'Bearer admin-token').pipe(
          Effect.provide(TestDependencies)
        )
      );

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('test@example.com');
      expect(result[1].username).toBe('admin@example.com');
    });

    it('should reject list users with user token', async () => {
      await expect(
        Effect.runPromise(
          listUsersEffect({}, 'Bearer user-token').pipe(
            Effect.provide(TestDependencies)
          )
        )
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should get user with valid token', async () => {
      const result = await Effect.runPromise(
        getUserEffect('test@example.com', 'Bearer user-token').pipe(
          Effect.provide(TestDependencies)
        )
      );

      expect(result.username).toBe('test@example.com');
      expect(result.nickname).toBe('Test User');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('should reject get user without token', async () => {
      await expect(
        Effect.runPromise(
          getUserEffect('test@example.com').pipe(
            Effect.provide(TestDependencies)
          )
        )
      ).rejects.toThrow('Missing or invalid authorization header');
    });

    it('should handle user not found', async () => {
      await expect(
        Effect.runPromise(
          getUserEffect('nonexistent@example.com', 'Bearer user-token').pipe(
            Effect.provide(TestDependencies)
          )
        )
      ).rejects.toThrow('User not found');
    });

    it('should create user with admin token', async () => {
      const userData = {
        username: 'new@example.com',
        password: 'password123',
        nickname: 'New User',
        roles: ['user'],
      };

      const result = await Effect.runPromise(
        createUserEffect(userData, 'Bearer admin-token').pipe(
          Effect.provide(TestDependencies)
        )
      );

      expect(result).toEqual({
        'user-id': 'new-id',
        username: 'new@example.com',
      });
    });

    it('should handle user conflict on creation', async () => {
      const userData = {
        username: 'existing@example.com',
        password: 'password123',
        nickname: 'Existing User',
        roles: ['user'],
      };

      await expect(
        Effect.runPromise(
          createUserEffect(userData, 'Bearer admin-token').pipe(
            Effect.provide(TestDependencies)
          )
        )
      ).rejects.toThrow('User already exists');
    });

    it('should update user with admin token', async () => {
      const updateData = {
        username: 'test@example.com',
        nickname: 'Updated Test User',
        roles: ['user', 'moderator'],
      };

      const result = await Effect.runPromise(
        updateUserEffect('test@example.com', updateData, 'Bearer admin-token').pipe(
          Effect.provide(TestDependencies)
        )
      );

      expect(result).toEqual({
        'user-id': '1',
        username: 'test@example.com',
      });
    });

    it('should delete user with admin token', async () => {
      const result = await Effect.runPromise(
        deleteUserEffect('test@example.com', 'Bearer admin-token').pipe(
          Effect.provide(TestDependencies)
        )
      );

      expect(result).toBeUndefined();
    });

    it('should reject delete user with user token', async () => {
      await expect(
        Effect.runPromise(
          deleteUserEffect('test@example.com', 'Bearer user-token').pipe(
            Effect.provide(TestDependencies)
          )
        )
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('Express Integration Helper', () => {
    it('should create Express-compatible handler', () => {
      const mockReq = {
        query: {},
        headers: { authorization: 'Bearer admin-token' }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const mockNext = jest.fn();

      const effect = listUsersEffect(mockReq.query, mockReq.headers.authorization);
      const handler = runEffectRoute(effect, TestDependencies);

      expect(typeof handler).toBe('function');
    });

    it('should handle successful response', async () => {
      const mockReq = {
        query: {},
        headers: { authorization: 'Bearer admin-token' }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const mockNext = jest.fn();

      const effect = listUsersEffect(mockReq.query, mockReq.headers.authorization);
      const handler = runEffectRoute(effect, TestDependencies);

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ username: 'test@example.com' }),
        expect.objectContaining({ username: 'admin@example.com' })
      ]));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle EffectHttpError', async () => {
      const mockReq = {
        query: {},
        headers: { authorization: 'Bearer user-token' }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const mockNext = jest.fn();

      const effect = listUsersEffect(mockReq.query, mockReq.headers.authorization);
      const handler = runEffectRoute(effect, TestDependencies);

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        details: undefined
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle 204 No Content for undefined result', async () => {
      const mockReq = {
        params: { username: 'test@example.com' },
        headers: { authorization: 'Bearer admin-token' }
      };
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      const mockNext = jest.fn();

      const effect = deleteUserEffect(mockReq.params.username, mockReq.headers.authorization);
      const handler = runEffectRoute(effect, TestDependencies);

      await handler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Effect Composition', () => {
    it('should compose effects properly for full workflow', async () => {
      // Test a complete workflow: create, get, update, delete
      const createData = {
        username: 'workflow@example.com',
        password: 'password123',
        nickname: 'Workflow User',
        roles: ['user'],
      };

      const workflowEffect = Effect.gen(function* () {
        // Create user
        const created = yield* createUserEffect(createData, 'Bearer admin-token');

        // Get user
        const retrieved = yield* getUserEffect(created.username, 'Bearer user-token');

        // Update user
        const updateData = {
          username: created.username,
          nickname: 'Updated Workflow User',
          roles: ['user', 'moderator'],
        };
        const updated = yield* updateUserEffect(created.username, updateData, 'Bearer admin-token');

        // Delete user
        yield* deleteUserEffect(created.username, 'Bearer admin-token');

        return { created, retrieved, updated };
      });

      const result = await Effect.runPromise(
        workflowEffect.pipe(Effect.provide(TestDependencies))
      );

      expect(result.created.username).toBe('workflow@example.com');
      expect(result.retrieved.username).toBe('workflow@example.com');
      expect(result.updated.username).toBe('workflow@example.com');
    });

    it('should handle errors in composed effects', async () => {
      const errorWorkflow = Effect.gen(function* () {
        // Try to create a user with an existing username
        const userData = {
          username: 'existing@example.com',
          password: 'password123',
          nickname: 'Existing User',
          roles: ['user'],
        };

        yield* createUserEffect(userData, 'Bearer admin-token');

        // This should not execute due to the error above
        const users = yield* listUsersEffect({}, 'Bearer admin-token');

        return users;
      });

      await expect(
        Effect.runPromise(
          errorWorkflow.pipe(Effect.provide(TestDependencies))
        )
      ).rejects.toThrow('User already exists');
    });

    it('should maintain type safety throughout composition', async () => {
      const typedWorkflow = Effect.gen(function* () {
        const users = yield* listUsersEffect({}, 'Bearer admin-token');
        const user = yield* getUserEffect('test@example.com', 'Bearer user-token');

        // TypeScript should enforce these types
        const userCount: number = users.length;
        const username: string = user.username;
        const roles: string[] = user.roles;

        return { userCount, username, roles };
      });

      const result = await Effect.runPromise(
        typedWorkflow.pipe(Effect.provide(TestDependencies))
      );

      expect(typeof result.userCount).toBe('number');
      expect(typeof result.username).toBe('string');
      expect(Array.isArray(result.roles)).toBe(true);
    });
  });
});

/**
 * Test Coverage Summary for Simplified Effect Routes:
 *
 * ✅ Error Classes (all custom HTTP error types)
 * ✅ Authentication Helpers (token extraction, validation, role checking)
 * ✅ User Operations (all CRUD operations with various scenarios)
 * ✅ Express Integration Helper (runEffectRoute function)
 * ✅ Effect Composition (complex workflows, error handling, type safety)
 *
 * This comprehensive test suite demonstrates:
 * - Proper Effect patterns testing with simplified approach
 * - Mock service implementations with proper context binding
 * - Authentication and authorization flow testing
 * - Error scenario coverage with custom error types
 * - Express integration testing
 * - Complex Effect composition validation
 * - Type safety verification
 * - Complete CRUD operation coverage
 * - Resource management and error propagation
 */