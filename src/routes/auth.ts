import express from 'express';
import { UserModel, CreateUserData } from '../models/User';
import { generateToken } from '../middleware/auth';
import { config } from '../config';

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

// Login endpoint - GET /auth/login
router.get('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      res
        .status(400)
        .json({ error: 'Missing required fields: username, password' });
      return;
    }

    // Find user in database
    const user = await UserModel.findActiveByUsername(username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify password
    const isPasswordValid = await UserModel.verifyPassword(
      password,
      user.password_hash,
    );
    if (!isPasswordValid) {
      res.status(403).json({ error: 'Wrong password' });
      return;
    }

    // Generate JWT token
    try {
      const token = generateToken(user.username, user.roles, user.nickname);

      res.status(201).json({
        'user-auth-token': token,
        expires_in: config.jwt.expiresIn,
        token_type: 'Bearer',
      });
    } catch (error) {
      console.error('Error creating token:', error);
      res.status(500).json({ error: 'Error in creating token' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Registration endpoint - POST /hunt/auth/register
router.post('/register', async (req, res) => {
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
      res.status(403).json({ error: 'Username must be a valid email address' });
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
});

export default router;
