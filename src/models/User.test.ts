import { UserModel, CreateUserData, UpdateUserData } from './User';
import { initializeDatabase, closePool, getClient } from '../database';
import { resetMockDatabase } from '../__mocks__/database';

// Test configuration is handled by setupTests.ts and environment variables

describe('UserModel', () => {
  beforeAll(async () => {
    // Setup test database
    await initializeDatabase();
  });

  afterAll(async () => {
    // Cleanup database connections
    await closePool();
  });

  beforeEach(async () => {
    // Reset mock database state before each test
    resetMockDatabase();
    
    // Clean up users table before each test
    const client = await getClient();
    try {
      await client.query('DELETE FROM users');
    } finally {
      client.release();
    }
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      const user = await UserModel.create(userData);

      expect(user.username).toBe(userData.username);
      expect(user.nickname).toBe(userData.nickname);
      expect(user.roles).toEqual(userData.roles);
      expect(user.password_hash).not.toBe(userData.password);
      expect(user.user_id).toBeDefined();
      expect(user.valid_from).toBeDefined();
      expect(user.valid_until).toBeNull();
    });

    it('should throw error when creating duplicate user', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      await UserModel.create(userData);
      
      await expect(UserModel.create(userData)).rejects.toThrow();
    });
  });

  describe('findActiveByUsername', () => {
    it('should find active user by username', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findActiveByUsername(userData.username);

      expect(foundUser).toBeDefined();
      expect(foundUser?.user_id).toBe(createdUser.user_id);
      expect(foundUser?.username).toBe(userData.username);
    });

    it('should return null for non-existent user', async () => {
      const foundUser = await UserModel.findActiveByUsername('nonexistent@example.com');
      expect(foundUser).toBeNull();
    });

    it('should not find deleted user', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      await UserModel.create(userData);
      await UserModel.delete(userData.username);
      
      const foundUser = await UserModel.findActiveByUsername(userData.username);
      expect(foundUser).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user with new values', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      await UserModel.create(userData);

      const updateData: UpdateUserData = {
        username: 'test@example.com',
        password: 'NewPassword123!',
        nickname: 'UpdatedUser',
        roles: ['admin'],
      };

      const updatedUser = await UserModel.update(userData.username, updateData);

      expect(updatedUser.nickname).toBe(updateData.nickname);
      expect(updatedUser.roles).toEqual(updateData.roles);
      expect(updatedUser.username).toBe(updateData.username);
      
      // Verify password was actually changed
      const isOldPasswordValid = await UserModel.verifyPassword(userData.password, updatedUser.password_hash);
      const isNewPasswordValid = await UserModel.verifyPassword(updateData.password!, updatedUser.password_hash);
      expect(isOldPasswordValid).toBe(false);
      expect(isNewPasswordValid).toBe(true);
    });

    it('should throw error when no changes required', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      await UserModel.create(userData);

      const updateData: UpdateUserData = {
        username: 'test@example.com',
        nickname: 'TestUser',
        roles: ['user'],
      };

      await expect(UserModel.update(userData.username, updateData)).rejects.toThrow('No change required');
    });

    it('should throw error when user not found', async () => {
      const updateData: UpdateUserData = {
        username: 'nonexistent@example.com',
        nickname: 'UpdatedUser',
        roles: ['admin'],
      };

      await expect(UserModel.update('nonexistent@example.com', updateData)).rejects.toThrow('User not found');
    });
  });

  describe('delete', () => {
    it('should soft delete user (set valid_until)', async () => {
      const userData: CreateUserData = {
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'TestUser',
        roles: ['user'],
      };

      await UserModel.create(userData);
      await UserModel.delete(userData.username);

      const foundUser = await UserModel.findActiveByUsername(userData.username);
      expect(foundUser).toBeNull();
    });

    it('should throw error when deleting non-existent user', async () => {
      await expect(UserModel.delete('nonexistent@example.com')).rejects.toThrow('User not found');
    });
  });

  describe('password operations', () => {
    it('should hash passwords consistently', async () => {
      const password = 'TestPassword123!';
      const hash1 = await UserModel.hashPassword(password);
      const hash2 = await UserModel.hashPassword(password);

      expect(hash1).not.toBe(password);
      expect(hash2).not.toBe(password);
      expect(hash1).not.toBe(hash2); // Should use salt
    });

    it('should verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await UserModel.hashPassword(password);

      const isValid = await UserModel.verifyPassword(password, hash);
      const isInvalid = await UserModel.verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe('getAllActive', () => {
    it('should return all active users', async () => {
      const users = [
        { username: 'user1@example.com', password: 'Password123!', nickname: 'User1', roles: ['user'] },
        { username: 'user2@example.com', password: 'Password123!', nickname: 'User2', roles: ['admin'] },
      ];

      for (const userData of users) {
        await UserModel.create(userData);
      }

      const activeUsers = await UserModel.getAllActive();
      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.map(u => u.username).sort()).toEqual(['user1@example.com', 'user2@example.com']);
    });

    it('should not include deleted users', async () => {
      const userData1: CreateUserData = {
        username: 'user1@example.com',
        password: 'Password123!',
        nickname: 'User1',
        roles: ['user'],
      };

      const userData2: CreateUserData = {
        username: 'user2@example.com',
        password: 'Password123!',
        nickname: 'User2',
        roles: ['user'],
      };

      await UserModel.create(userData1);
      await UserModel.create(userData2);
      await UserModel.delete(userData1.username);

      const activeUsers = await UserModel.getAllActive();
      expect(activeUsers).toHaveLength(1);
      expect(activeUsers[0].username).toBe(userData2.username);
    });
  });
});