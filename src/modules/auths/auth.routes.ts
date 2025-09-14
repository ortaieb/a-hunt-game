import express from 'express';
import { userService } from '../users/user.service';
import { generateToken } from '../../shared/middleware/auth';
import { config } from '../../config';
import { AppError } from '../../shared/types/errors';

const router = express.Router();

// Login endpoint - GET /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      res.status(400).json({ error: 'Missing required fields: username, password' });
      return;
    }

    // Find user in database
    const rawUser = await userService.getUser(username);
    if (!rawUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = await userService.validateUser(rawUser, password);
    const token = generateToken(user.username, user.roles, user.nickname);

    res.status(201).json({
      'user-auth-token': token,
      expires_in: config.jwt.expiresIn,
      token_type: 'Bearer',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Registration endpoint - POST /hunt/auth/register
router.post('/register', async (req, res) => {
  try {
    const newUser = await userService.createUser(req.body);

    res.status(200).json({
      'user-id': newUser.user_id,
      username: newUser.username,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(403).json({
        error: error instanceof Error ? error.message : 'Failed to create user',
      });
    }
  }
});

export default router;
