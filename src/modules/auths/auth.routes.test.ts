import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { config } from '../../config';
import { uuidV7ForTest } from '../../test-support/funcs/uuid';
import { userService } from '../users/user.service';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/types/errors';

// Mock userService
jest.mock('../users/user.service');
const mockedUserService = userService as jest.Mocked<typeof userService>;

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        password_hash: '$2b$12$4VhFxF1Usk2lV0pXjTGzYenZmgB92fQ9edG3LG.rjHg4PDChN/1jy',
        nickname: 'Test User',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      const mockUserResponse = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        nickname: 'Test User',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserService.getUser.mockResolvedValue(mockUser);
      mockedUserService.validateUser.mockResolvedValue(mockUserResponse);

      const response = await request(app).post('/hunt/auth/login').send({
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
      expect(decoded.roles).toEqual(['game.player']);
    });

    it('should return 404 for non-existent user', async () => {
      mockedUserService.getUser.mockRejectedValue(new NotFoundError('User not found'));

      const response = await request(app).post('/hunt/auth/login').send({
        username: 'nonexistent@example.com',
        password: 'password',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'User not found' });
    });

    it('should return 401 for wrong password', async () => {
      const mockUser = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserService.getUser.mockResolvedValue(mockUser);
      mockedUserService.validateUser.mockRejectedValue(
        new UnauthorizedError('Invalid credentials'),
      );

      const response = await request(app).post('/hunt/auth/login').send({
        username: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid credentials' });
    });

    it('should return 400 for missing username', async () => {
      const response = await request(app).post('/hunt/auth/login').send({
        password: 'password',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: username, password',
      });
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app).post('/hunt/auth/login').send({
        username: 'test@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: username, password',
      });
    });

    it('should return 500 for token creation error', async () => {
      const mockUser = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      const mockUserResponse = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        nickname: 'Test User',
        roles: ['user'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserService.getUser.mockResolvedValue(mockUser);
      mockedUserService.validateUser.mockResolvedValue(mockUserResponse);

      // Mock jwt.sign to throw error
      const originalSign = jwt.sign;
      jwt.sign = jest.fn().mockImplementation(() => {
        throw new Error('Token creation failed');
      });

      const response = await request(app).post('/hunt/auth/login').send({
        username: 'test@example.com',
        password: 'validpassword',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });

      // Restore original jwt.sign
      jwt.sign = originalSign;
    });
  });

  describe('POST /hunt/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        user_id: uuidV7ForTest(0, 2),
        username: 'newuser@example.com',
        nickname: 'New User',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserService.createUser.mockResolvedValue(newUser);

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'newuser@example.com',
          password: 'Password123!',
          nickname: 'New User',
          roles: ['game.player'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'user-id': uuidV7ForTest(0, 2),
        username: 'newuser@example.com',
      });
    });

    it('should return 403 for missing required fields', async () => {
      // Mock userService to reject with validation error
      mockedUserService.createUser.mockRejectedValue(new Error('Validation failed'));

      const response = await request(app).post('/hunt/auth/register').send({
        username: 'test@example.com',
        password: 'Password123!',
        // Missing nickname and roles
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for invalid email format', async () => {
      // Mock userService to reject with validation error
      mockedUserService.createUser.mockRejectedValue(new Error('Invalid email format'));

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'invalid-email',
          password: 'Password123!',
          nickname: 'Test User',
          roles: ['game.player'],
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for weak password', async () => {
      // Mock userService to reject with validation error
      mockedUserService.createUser.mockRejectedValue(new Error('Password validation failed'));

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'test@example.com',
          password: 'weak',
          nickname: 'Test User',
          roles: ['game.player'],
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for invalid roles format', async () => {
      // Mock userService to reject with validation error
      mockedUserService.createUser.mockRejectedValue(new Error('Invalid roles format'));

      const response = await request(app).post('/hunt/auth/register').send({
        username: 'test@example.com',
        password: 'Password123!',
        nickname: 'Test User',
        roles: 'not-an-array',
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for existing user', async () => {
      mockedUserService.createUser.mockRejectedValue(new ConflictError('User already exists'));

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'existing@example.com',
          password: 'Password123!',
          nickname: 'Test User',
          roles: ['game.player'],
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'User already exists' });
    });
  });

  describe('Alternative route paths', () => {
    it('should access login via /hunt/auth/login', async () => {
      const mockUser = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        password_hash: '$2b$12$hashedpassword',
        nickname: 'Test User',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      const mockUserResponse = {
        user_id: uuidV7ForTest(0, 1),
        username: 'test@example.com',
        nickname: 'Test User',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserService.getUser.mockResolvedValue(mockUser);
      mockedUserService.validateUser.mockResolvedValue(mockUserResponse);

      const response = await request(app).post('/hunt/auth/login').send({
        username: 'test@example.com',
        password: 'validpassword',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user-auth-token');
    });

    it('should access register via /hunt/auth/register', async () => {
      const newUser = {
        user_id: uuidV7ForTest(0, 2),
        username: 'newuser@example.com',
        nickname: 'New User',
        roles: ['game.player'],
        valid_from: new Date(),
        valid_until: null,
      };

      mockedUserService.createUser.mockResolvedValue(newUser);

      const response = await request(app)
        .post('/hunt/auth/register')
        .send({
          username: 'newuser@example.com',
          password: 'Password123!',
          nickname: 'New User',
          roles: ['game.player'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        'user-id': uuidV7ForTest(0, 2),
        username: 'newuser@example.com',
      });
    });
  });
});
