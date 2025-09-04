import { Router, Request, Response } from 'express';
import { waypointService } from './waypoint.service';
import { authenticateToken, requireRole } from '../../shared/middleware/auth';
import {
  createWaypointSequenceSchema,
  deleteWaypointSequenceSchema,
  updateWaypointSequenceSchema,
} from './waypoint.validator';
import { validate } from './../../shared/middleware/validation';
import { asyncHandler } from '../../shared/middleware/asyncHandler';

const router = Router();

// Get specific waypoint sequence by name
router.get(
  '/:waypoint_name',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const record = await waypointService.getWaypointSequence(req.params.waypoint_name);
    res.json(record);
  }),
);

// Create new waypoint sequence
router.post(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  validate(createWaypointSequenceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const record = await waypointService.createWaypointSequence(req.body);
    res.status(201).json(record);
  }),
);

// Update waypoint sequence
router.put(
  '/:waypoint_name',
  authenticateToken,
  requireRole('game.admin'),
  validate(updateWaypointSequenceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const record = await waypointService.updateWaypointSequence(req.params.waypoint_name, req.body);
    res.status(201).json(record);
  }),
);

// Delete waypoint sequence
router.delete(
  '/:waypoint_name',
  authenticateToken,
  requireRole('game.admin'),
  validate(deleteWaypointSequenceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await waypointService.createWaypointSequence(req.body);
    res.status(204).send();
  }),
);

export default router;
