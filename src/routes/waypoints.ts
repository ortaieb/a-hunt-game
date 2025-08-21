import express from 'express';
import {
  WaypointModel,
  CreateWaypointSequenceData,
  UpdateWaypointSequenceData,
} from '../models/Waypoint';
import {
  authenticateToken,
  requireRole,
  AuthenticatedRequest,
} from '../middleware/auth';
import { Waypoint } from '../schema/waypoints';
import { instanceToPlain, plainToClass } from 'class-transformer';

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
      const waypointSequences = await WaypointModel.getAllActive();

      res.status(200).json({
        waypoint_sequences: waypointSequences.map((sequence) => ({
          waypoints_id: sequence.waypoints_id,
          waypoint_name: sequence.waypoint_name,
          waypoint_description: sequence.waypoint_description,
          data: sequence.data.map(waypoint => instanceToPlain(Object.assign(new Waypoint(), waypoint))),
          valid_from: sequence.valid_from,
        })),
      });
    } catch (error) {
      console.error('Error fetching waypoint sequences:', error);
      res.status(500).json({
        error: 'Failed to fetch waypoint sequences',
      });
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

      const waypointSequence =
        await WaypointModel.findActiveByName(waypoint_name);

      if (!waypointSequence) {
        res.status(404).json({ error: 'Waypoint sequence not found' });
        return;
      }

      res.status(200).json({
        waypoints_id: waypointSequence.waypoints_id,
        waypoint_name: waypointSequence.waypoint_name,
        waypoint_description: waypointSequence.waypoint_description,
        data: waypointSequence.data.map(waypoint => instanceToPlain(Object.assign(new Waypoint(), waypoint))),
        valid_from: waypointSequence.valid_from,
      });
    } catch (error) {
      console.error('Error fetching waypoint sequence:', error);
      res.status(500).json({
        error: 'Failed to fetch waypoint sequence',
      });
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
          error:
            'Missing required fields: waypoint_name, waypoint_description, data',
        });
        return;
      }

      if (!isValidWaypointName(waypoint_name)) {
        res
          .status(400)
          .json({ error: 'waypoint_name must be 1-255 characters long' });
        return;
      }

      if (
        typeof waypoint_description !== 'string' ||
        waypoint_description.length === 0
      ) {
        res
          .status(400)
          .json({ error: 'waypoint_description must be a non-empty string' });
        return;
      }

      // Check if waypoint sequence already exists
      const existingWaypoint =
        await WaypointModel.findActiveByName(waypoint_name);
      if (existingWaypoint) {
        res
          .status(409)
          .json({ error: 'Waypoint sequence with this name already exists' });
        return;
      }

      // Convert kebab-case JSON data to internal format using class-transformer
      const internalData = (data as Record<string, unknown>[]).map(jsonWaypoint => 
        plainToClass(Waypoint, jsonWaypoint),
      );

      const waypointData: CreateWaypointSequenceData = {
        waypoint_name,
        waypoint_description,
        data: internalData,
      };

      const newWaypointSequence = await WaypointModel.create(waypointData);

      res.status(201).json({
        waypoints_id: newWaypointSequence.waypoints_id,
        waypoint_name: newWaypointSequence.waypoint_name,
        waypoint_description: newWaypointSequence.waypoint_description,
        data: newWaypointSequence.data.map(waypoint => instanceToPlain(Object.assign(new Waypoint(), waypoint))),
      });
    } catch (error) {
      console.error('Error creating waypoint sequence:', error);
      if (error instanceof Error) {
        // Validation errors from WaypointModel
        res.status(400).json({ error: error.message });
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
          error:
            'Missing required fields: waypoint_name, waypoint_description, data',
        });
        return;
      }

      if (!isValidWaypointName(waypoint_name)) {
        res
          .status(400)
          .json({ error: 'waypoint_name must be 1-255 characters long' });
        return;
      }

      if (
        typeof waypoint_description !== 'string' ||
        waypoint_description.length === 0
      ) {
        res
          .status(400)
          .json({ error: 'waypoint_description must be a non-empty string' });
        return;
      }

      // URL waypoint name should match body waypoint name for consistency
      if (urlWaypointName !== waypoint_name) {
        res
          .status(400)
          .json({ error: 'URL waypoint_name must match body waypoint_name' });
        return;
      }

      // Convert kebab-case JSON data to internal format using class-transformer
      const internalData = (data as Record<string, unknown>[]).map(jsonWaypoint => 
        plainToClass(Waypoint, jsonWaypoint),
      );

      const waypointData: UpdateWaypointSequenceData = {
        waypoint_name,
        waypoint_description,
        data: internalData,
      };

      const updatedWaypointSequence = await WaypointModel.update(
        urlWaypointName,
        waypointData,
      );

      res.status(200).json({
        waypoints_id: updatedWaypointSequence.waypoints_id,
        waypoint_name: updatedWaypointSequence.waypoint_name,
        waypoint_description: updatedWaypointSequence.waypoint_description,
        data: updatedWaypointSequence.data.map(waypoint => instanceToPlain(Object.assign(new Waypoint(), waypoint))),
      });
    } catch (error) {
      console.error('Error updating waypoint sequence:', error);
      if (error instanceof Error) {
        if (error.message === 'Waypoint sequence not found') {
          res.status(404).json({ error: 'Waypoint sequence not found' });
          return;
        }
        if (error.message === 'No change required') {
          res.status(400).json({ error: 'No change required' });
          return;
        }
        // Validation errors
        res.status(400).json({ error: error.message });
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

      await WaypointModel.delete(waypoint_name);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting waypoint sequence:', error);
      if (
        error instanceof Error &&
        error.message === 'Waypoint sequence not found'
      ) {
        res.status(404).json({ error: 'Waypoint sequence not found' });
        return;
      }
      res.status(500).json({
        error: 'Failed to delete waypoint sequence',
      });
    }
  },
);

export default router;
