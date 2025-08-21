import express from 'express';
import { UserModel, CreateUserData, UpdateUserData } from '../models/User';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth';

const router = express.Router();

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate password strength
const isValidPassword = (password: string): boolean => {
  // At least 8 characters, contains letter and number
  const minLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return minLength && hasLetter && hasNumber;
};

// Create new user
router.post(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { username, password, nickname, roles } = req.body;

      // Validate input
      if (!username || !password || !nickname || !roles) {
        res.status(403).json({
          error: 'Missing required fields: username, password, nickname, roles',
        });
        return;
      }

      if (!isValidEmail(username)) {
        res
          .status(403)
          .json({ error: 'Username must be a valid email address' });
        return;
      }

      if (!isValidPassword(password)) {
        res.status(403).json({
          error:
            'Password must be at least 8 characters with letters and numbers',
        });
        return;
      }

      if (!Array.isArray(roles)) {
        res.status(403).json({ error: 'Roles must be an array' });
        return;
      }

      // Check if user already exists
      const existingUser = await UserModel.findActiveByUsername(username);
      if (existingUser) {
        res.status(403).json({ error: 'User already exists' });
        return;
      }

      const userData: CreateUserData = {
        username,
        password,
        nickname,
        roles,
      };

      const newUser = await UserModel.create(userData);

      res.status(200).json({
        'user-id': newUser.user_id,
        username: newUser.username,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(403).json({
        error: error instanceof Error ? error.message : 'Failed to create user',
      });
    }
  },
);

// Delete user
router.delete(
  '/:username',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { username } = req.params;

      if (!username) {
        res.status(403).json({ error: 'Username is required' });
        return;
      }

      await UserModel.delete(username);
      res.status(200).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      if (error instanceof Error && error.message === 'User not found') {
        res.status(403).json({ error: 'User not found' });
        return;
      }
      res.status(403).json({
        error: error instanceof Error ? error.message : 'Failed to delete user',
      });
    }
  },
);

// Update user
router.put(
  '/:username',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { username: urlUsername } = req.params;
      const { username, password, nickname, roles } = req.body;

      // Validate input
      if (!username || !nickname || !roles) {
        res.status(403).json({
          error: 'Missing required fields: username, nickname, roles',
        });
        return;
      }

      if (!isValidEmail(username)) {
        res
          .status(403)
          .json({ error: 'Username must be a valid email address' });
        return;
      }

      if (password && !isValidPassword(password)) {
        res.status(403).json({
          error:
            'Password must be at least 8 characters with letters and numbers',
        });
        return;
      }

      if (!Array.isArray(roles)) {
        res.status(403).json({ error: 'Roles must be an array' });
        return;
      }

      // URL username should match body username for consistency
      if (urlUsername !== username) {
        res
          .status(403)
          .json({ error: 'URL username must match body username' });
        return;
      }

      const userData: UpdateUserData = {
        username,
        password,
        nickname,
        roles,
      };

      const updatedUser = await UserModel.update(urlUsername, userData);

      res.status(200).json({
        'user-id': updatedUser.user_id,
        username: updatedUser.username,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          res.status(403).json({ error: 'User not found' });
          return;
        }
        if (error.message === 'No change required') {
          res.status(400).json({ error: 'No change required' });
          return;
        }
      }
      res.status(403).json({
        error: error instanceof Error ? error.message : 'Failed to update user',
      });
    }
  },
);

export default router;
