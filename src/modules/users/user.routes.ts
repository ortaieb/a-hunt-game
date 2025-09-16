// src/modules/user/user.routes.ts
import { Router, Request, Response } from 'express';
import { userService } from './user.service';
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  listUsersSchema,
} from './user.validator';
import { validate } from './../../shared/middleware/validation';
import { authenticateToken, requireRole } from './../../shared/middleware/auth';
import { asyncHandler } from './../../shared/middleware/asyncHandler';

const router = Router();

// List users
router.get(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  validate(listUsersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const users = await userService.listUsers(req.query || {});
    res.json(users);
  }),
);

// Get single user
router.get(
  '/:username',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUser(req.params.username);
    res.json(user);
  }),
);

// Create user
router.post(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  validate(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body);
    res.status(201).json({
      'user-id': user.user_id,
      username: user.username,
    });
  }),
);

// Update user
router.put(
  '/:username',
  authenticateToken,
  requireRole('game.admin'),
  validate(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateUser(req.params.username, req.body);
    res.json({
      'user-id': user.user_id,
      username: user.username,
    });
  }),
);

// Delete user
router.delete(
  '/:username',
  authenticateToken,
  requireRole('game.admin'),
  validate(deleteUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteUser(req.params.username);
    res.status(204).send();
  }),
);

export default router;
