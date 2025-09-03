import express from 'express';
import { waypointService } from './waypoint.service';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/types/errors';

const router = express.Router();

// Helper function to validate waypoint name
const isValidWaypointName = (name: string): boolean => {
  return Boolean(name) && name.trim().length > 0 && name.length <= 255;
};

// Get all active waypoint sequences
router.get(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const sequences = await waypointService.getAllActiveWaypointSequences();

      res.status(200).json({
        waypoint_sequences: sequences,
      });
    } catch (error) {
      console.error('Error fetching waypoint sequences:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to fetch waypoint sequences',
        });
      }
    }
  },
);

// Get summary of available waypoint sequences (names and descriptions only)
router.get(
  '/summary',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const summaries = await waypointService.getWaypointSequencesSummary();

      res.status(200).json({
        waypoint_sequences_summary: summaries,
      });
    } catch (error) {
      console.error('Error fetching waypoint sequences summary:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to fetch waypoint sequences summary',
        });
      }
    }
  },
);

// Get specific waypoint sequence by name
router.get(
  '/:waypoint_name',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { waypoint_name } = req.params;

      if (!isValidWaypointName(waypoint_name)) {
        res.status(400).json({ error: 'Invalid waypoint name' });
        return;
      }

      const sequence = await waypointService.getWaypointSequence(waypoint_name);

      res.status(200).json(sequence);
    } catch (error) {
      console.error('Error fetching waypoint sequence:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to fetch waypoint sequence',
        });
      }
    }
  },
);

// Create new waypoint sequence
router.post(
  '/',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { waypoint_name, waypoint_description, data } = req.body;

      // Validate input
      if (!waypoint_name || !waypoint_description || !data) {
        res.status(400).json({
          error: 'Missing required fields: waypoint_name, waypoint_description, data',
        });
        return;
      }

      if (!isValidWaypointName(waypoint_name)) {
        res.status(400).json({ error: 'waypoint_name must be 1-255 characters long' });
        return;
      }

      if (typeof waypoint_description !== 'string' || waypoint_description.length === 0) {
        res.status(400).json({ error: 'waypoint_description must be a non-empty string' });
        return;
      }

      const newSequence = await waypointService.createWaypointSequence(req.body);

      res.status(201).json(newSequence);
    } catch (error) {
      console.error('Error creating waypoint sequence:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create waypoint sequence' });
      }
    }
  },
);

// Update waypoint sequence
router.put(
  '/:waypoint_name',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { waypoint_name: urlWaypointName } = req.params;
      const { waypoint_name, waypoint_description, data } = req.body;

      // Validate input
      if (!waypoint_name || !waypoint_description || !data) {
        res.status(400).json({
          error: 'Missing required fields: waypoint_name, waypoint_description, data',
        });
        return;
      }

      if (!isValidWaypointName(waypoint_name)) {
        res.status(400).json({ error: 'waypoint_name must be 1-255 characters long' });
        return;
      }

      if (typeof waypoint_description !== 'string' || waypoint_description.length === 0) {
        res.status(400).json({ error: 'waypoint_description must be a non-empty string' });
        return;
      }

      const updatedSequence = await waypointService.updateWaypointSequence(urlWaypointName, req.body);

      res.status(200).json(updatedSequence);
    } catch (error) {
      console.error('Error updating waypoint sequence:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update waypoint sequence' });
      }
    }
  },
);

// Delete waypoint sequence
router.delete(
  '/:waypoint_name',
  authenticateToken,
  requireRole('game.admin'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { waypoint_name } = req.params;

      if (!isValidWaypointName(waypoint_name)) {
        res.status(400).json({ error: 'Invalid waypoint name' });
        return;
      }

      await waypointService.deleteWaypointSequence(waypoint_name);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting waypoint sequence:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to delete waypoint sequence',
        });
      }
    }
  },
);

export default router;