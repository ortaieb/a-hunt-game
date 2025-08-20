import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { UserModel } from '../models/User';
import { config } from '../config';

// Mock UserModel
jest.mock('../models/User');
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        user_id: 1,
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(mockUser);
      mockedUserModel.verifyPassword.mockResolvedValue(true);

      const response = await request(app)
        .get('/auth/login')
        .send({
          username: 'test@example.com',
          password: 'validpassword',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user-auth-token');
      expect(response.body).toHaveProperty('expires_in', config.jwt.expiresIn);
      expect(response.body).toHaveProperty('token_type', 'Bearer');

      // Verify token contains correct claims
      const token = response.body['user-auth-token'];
      const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
      expect(decoded.iss).toBe('scavenger-hunt-game');
      expect(decoded.upn).toBe('test@example.com');
      expect(decoded.nickname).toBe('Test User');
      expect(decoded.roles).toEqual(['user']);
    });

    it('should return 404 for non-existent user', async () => {
      mockedUserModel.findActiveByUsername.mockResolvedValue(null);

      const response = await request(app)
        .get('/auth/login')
        .send({
          username: 'nonexistent@example.com',
          password: 'password',
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 403 for wrong password', async () => {
      const mockUser = {
        user_id: 1,
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(mockUser);
      mockedUserModel.verifyPassword.mockResolvedValue(false);

      const response = await request(app)
        .get('/auth/login')
        .send({
          username: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Wrong password' });
    });

    it('should return 400 for missing username', async () => {
      const response = await request(app)
        .get('/auth/login')
        .send({
          password: 'password',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing required fields: username, password' });
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .get('/auth/login')
        .send({
          username: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Missing required fields: username, password' });
    });

    it('should return 500 for token creation error', async () => {
      const mockUser = {
        user_id: 1,
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(mockUser);
      mockedUserModel.verifyPassword.mockResolvedValue(true);

      // Mock jwt.sign to throw error
      const originalSign = jwt.sign;
      jwt.sign = jest.fn().mockImplementation(() => {
        throw new Error('Token creation failed');
      });

      const response = await request(app)
        .get('/auth/login')
        .send({
          username: 'test@example.com',
          password: 'validpassword',
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Error in creating token' });

      // Restore original jwt.sign
      jwt.sign = originalSign;
    });
  });

  describe('POST /hunt/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        user_id: 2,
        username: 'newuser@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'New User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(null); // User doesn't exist
      mockedUserModel.create.mockResolvedValue(newUser);

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'newuser@example.com',
          password: 'Password123!',
          nickname: 'New User',
          roles: ['user'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'user-id': 2,
        username: 'newuser@example.com',
      });

      expect(mockedUserModel.create).toHaveBeenCalledWith({
        username: 'newuser@example.com',
        password: 'Password123!',
        nickname: 'New User',
        roles: ['user'],
      });
    });

    it('should return 403 for missing required fields', async () => {
      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'test@example.com',
          password: 'Password123!',
          // Missing nickname and roles
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Missing required fields: username, password, nickname, roles' });
    });

    it('should return 403 for invalid email format', async () => {
      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'invalid-email',
          password: 'Password123!',
          nickname: 'Test User',
          roles: ['user'],
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Username must be a valid email address' });
    });

    it('should return 403 for weak password', async () => {
      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'test@example.com',
          password: 'weak',
          nickname: 'Test User',
          roles: ['user'],
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Password must be at least 8 characters with letters and numbers' });
    });

    it('should return 403 for invalid roles format', async () => {
      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'test@example.com',
          password: 'Password123!',
          nickname: 'Test User',
          roles: 'not-an-array',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Roles must be an array' });
    });

    it('should return 403 for existing user', async () => {
      const existingUser = {
        user_id: 1,
        username: 'existing@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Existing User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'existing@example.com',
          password: 'Password123!',
          nickname: 'Test User',
          roles: ['user'],
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'User already exists' });
    });
  });

  describe('Alternative route paths', () => {
    it('should access login via /auth/login', async () => {
      const mockUser = {
        user_id: 1,
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(mockUser);
      mockedUserModel.verifyPassword.mockResolvedValue(true);

      const response = await request(app)
        .get('/auth/login')
        .send({
          username: 'test@example.com',
          password: 'validpassword',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user-auth-token');
    });

    it('should access register via /hunt/auth/register', async () => {
      const newUser = {
        user_id: 2,
        username: 'newuser@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'New User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserModel.findActiveByUsername.mockResolvedValue(null);
      mockedUserModel.create.mockResolvedValue(newUser);

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'newuser@example.com',
          password: 'Password123!',
          nickname: 'New User',
          roles: ['user'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'user-id': 2,
        username: 'newuser@example.com',
      });
    });
  });
});