import request from 'supertest';
import express from 'express';
import userRoutes from './users';
import { UserModel } from '../models/User';
import { generateToken } from '../middleware/auth';
import { v7 as uuidv7 } from 'uuid';
import { uuidV7ForTest } from '../test-support/funcs/uuid';

// Mock dependencies
jest.mock('../models/User');
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

const app = express();
app.use(express.json());
app.use('/hunt/users', userRoutes);

describe('User Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    jest.clearAllMocks();
    adminToken = generateToken('admin@local.domain', ['game.admin'], 'TestUser');
  });

  describe('POST /hunt/users', () => {
    const validUserData = {
      username: 'test@example.com',
      password: 'Password123!',
      nickname: 'TestUser',
      roles: ['user'],
    };

    it('should create new user with valid data and admin token', async () => {
      mockedUserModel.findActiveByUsername
        .mockResolvedValueOnce({
          user_id: uuidv7(),
          username: 'admin@local.domain',
          password_hash: 'hash',
          nickname: 'admin',
          roles: ['game.admin'],
          valid_from: new Date(),
          valid_until: null,
        })
        .mockResolvedValueOnce(null); // User doesn't exist yet

      mockedUserModel.create.mockResolvedValue({
        user_id: uuidV7ForTest(0, 0),
        username: validUserData.username,
        password_hash: 'hashedpassword',
        nickname: validUserData.nickname,
        roles: validUserData.roles,
        valid_from: new Date(),
        valid_until: null,
      });

      const response = await request(app)
        .post('/hunt/users')
        .set('user-auth-token', adminToken)
        .send(validUserData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'user-id': uuidV7ForTest(0, 0),
        username: validUserData.username,
      });
      expect(mockedUserModel.create).toHaveBeenCalledWith(validUserData);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).post('/hunt/users').send(validUserData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('request did not include token');
    });

    it('should return 403 with invalid email', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      const invalidData = { ...validUserData, username: 'invalid-email' };

      const response = await request(app)
        .post('/hunt/users')
        .set('user-auth-token', adminToken)
        .send(invalidData);

      expect(response?.status).toBe(403);
      expect(response?.body.error).toBe('Username must be a valid email address');
    });

    it('should return 403 with weak password', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      const weakPasswordData = { ...validUserData, password: '123' };

      const response = await request(app)
        .post('/hunt/users')
        .set('user-auth-token', adminToken)
        .send(weakPasswordData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(
        'Password must be at least 8 characters with letters and numbers',
      );
    });

    it('should return 403 when user already exists', async () => {
      mockedUserModel.findActiveByUsername
        .mockResolvedValueOnce({
          user_id: uuidV7ForTest(0, 1),
          username: 'admin@local.domain',
          password_hash: 'hash',
          nickname: 'admin',
          roles: ['game.admin'],
          valid_from: new Date(),
          valid_until: null,
        })
        .mockResolvedValueOnce({
          user_id: uuidV7ForTest(0, 2),
          username: validUserData.username,
          password_hash: 'hash',
          nickname: validUserData.nickname,
          roles: validUserData.roles,
          valid_from: new Date(),
          valid_until: null,
        });

      const response = await request(app)
        .post('/hunt/users')
        .set('user-auth-token', adminToken)
        .send(validUserData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('User already exists');
    });

    it('should return 403 with missing required fields', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      const incompleteData = { username: 'test@example.com' };

      const response = await request(app)
        .post('/hunt/users')
        .set('user-auth-token', adminToken)
        .send(incompleteData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe(
        'Missing required fields: username, password, nickname, roles',
      );
    });
  });

  describe('DELETE /hunt/users/:username', () => {
    it('should delete user with admin token', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      mockedUserModel.delete.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/hunt/users/test@example.com')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(200);
      expect(mockedUserModel.delete).toHaveBeenCalledWith('test@example.com');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).delete('/hunt/users/test@example.com');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('request did not include token');
    });

    it('should return 403 when user not found', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      mockedUserModel.delete.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .delete('/hunt/users/nonexistent@example.com')
        .set('user-auth-token', adminToken);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('PUT /hunt/users/:username', () => {
    const updateData = {
      username: 'test@example.com',
      password: 'NewPassword123!',
      nickname: 'UpdatedUser',
      roles: ['admin'],
    };

    it('should update user with valid data and admin token', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      mockedUserModel.update.mockResolvedValue({
        user_id: uuidV7ForTest(0, 2),
        username: updateData.username,
        password_hash: 'newhashedpassword',
        nickname: updateData.nickname,
        roles: updateData.roles,
        valid_from: new Date(),
        valid_until: null,
      });

      const response = await request(app)
        .put('/hunt/users/test@example.com')
        .set('user-auth-token', adminToken)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'user-id': uuidV7ForTest(0, 2),
        username: updateData.username,
      });
      expect(mockedUserModel.update).toHaveBeenCalledWith('test@example.com', updateData);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).put('/hunt/users/test@example.com').send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('request did not include token');
    });

    it('should return 403 when URL username differs from body username', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      const response = await request(app)
        .put('/hunt/users/different@example.com')
        .set('user-auth-token', adminToken)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('URL username must match body username');
    });

    it('should return 400 when no change required', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      mockedUserModel.update.mockRejectedValue(new Error('No change required'));

      const response = await request(app)
        .put('/hunt/users/test@example.com')
        .set('user-auth-token', adminToken)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No change required');
    });

    it('should return 403 when user not found', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      mockedUserModel.update.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .put('/hunt/users/test@example.com')
        .set('user-auth-token', adminToken)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 403 with invalid email format', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: uuidV7ForTest(0, 1),
        username: 'admin@local.domain',
        password_hash: 'hash',
        nickname: 'admin',
        roles: ['game.admin'],
        valid_from: new Date(),
        valid_until: null,
      });

      const invalidData = { ...updateData, username: 'invalid-email' };

      const response = await request(app)
        .put('/hunt/users/invalid-email')
        .set('user-auth-token', adminToken)
        .send(invalidData);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Username must be a valid email address');
    });
  });
});
