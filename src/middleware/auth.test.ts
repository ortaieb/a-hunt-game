import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { generateToken, verifyToken, authenticateToken, requireRole, AuthenticatedRequest } from './auth';
import { UserModel } from '../models/User';
import { config } from '../config';

// Mock UserModel
jest.mock('../models/User');
const mockedUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const username = 'test@example.com';
      const roles = ['user'];
      const nickname = 'test';

      const token = generateToken(username, roles, nickname);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token contains expected payload
      const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
      expect(decoded.username).toBe(username);
      expect(decoded.roles).toEqual(roles);
      expect(decoded.nickname).toEqual(nickname);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const username = 'test@example.com';
      const roles = ['user'];
      const nickname = 'test';
      const token = generateToken(username, roles, nickname);

      const payload = verifyToken(token);

      expect(payload.upn).toBe(username);
      expect(payload.roles).toEqual(roles);
      expect(payload.nickname).toEqual(nickname);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { username: 'test@example.com', roles: ['user'], nickname: 'test' },
        config.jwt.secret,
        { expiresIn: '-1h' },
      );

      expect(() => verifyToken(expiredToken)).toThrow('Invalid token');
    });
  });

  describe('authenticateToken', () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
      req = {
        headers: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should authenticate valid token', async () => {
      const username = 'test@example.com';
      const roles = ['user'];
      const nickname = 'test';
      const token = generateToken(username, roles, nickname);

      req.headers = { 'user-auth-token': token };

      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: 1,
        username,
        password_hash: 'hash',
        nickname: 'Test',
        roles,
        valid_from: new Date(),
        valid_until: null,
      });

      await authenticateToken(req as AuthenticatedRequest, res as Response, next);

      expect(req.user).toEqual({ username, roles });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', async () => {
      await authenticateToken(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'request did not include token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', async () => {
      req.headers = { 'user-auth-token': 'invalid.token' };

      await authenticateToken(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'request carries the wrong token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token for non-existent user', async () => {
      const username = 'test@example.com';
      const roles = ['user'];
      const nickname = 'test';
      const token = generateToken(username, roles, nickname);

      req.headers = { 'user-auth-token': token };
      mockedUserModel.findActiveByUsername.mockResolvedValue(null);

      await authenticateToken(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'request carries the wrong token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle array token header', async () => {
      const username = 'test@example.com';
      const roles = ['user'];
      const nickname = 'Test';
      const token = generateToken(username, roles, nickname);

      req.headers = { 'user-auth-token': [token, 'other-token'] };

      mockedUserModel.findActiveByUsername.mockResolvedValue({
        user_id: 1,
        username,
        password_hash: 'hash',
        nickname: 'Test',
        roles,
        valid_from: new Date(),
        valid_until: null,
      });

      await authenticateToken(req as AuthenticatedRequest, res as Response, next);

      expect(req.user).toEqual({ username, roles });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    let req: Partial<AuthenticatedRequest>;
    let res: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should allow access with required role', () => {
      req.user = {
        username: 'test@example.com',
        roles: ['user', 'game.admin'],
      };

      const middleware = requireRole('game.admin');
      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access without required role', () => {
      req.user = {
        username: 'test@example.com',
        roles: ['user'],
      };

      const middleware = requireRole('game.admin');
      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access without user context', () => {
      const middleware = requireRole('game.admin');
      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'request did not include token' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});