import { z } from 'zod';

// Reusable schemas
const waypointNameSchema = z
  .string()
  .min(1, 'Waypoint name is required')
  .max(255, 'Waypoint name must be 255 characters or less')
  .trim();

const waypointDescriptionSchema = z
  .string()
  .min(1, 'Waypoint description is required')
  .trim();

// Individual waypoint schema (matching schema/waypoints.ts structure)
const waypointSchema = z.object({
  waypoint_seq_id: z.number().int().positive('Waypoint sequence ID must be a positive number'),
  waypoint_latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  waypoint_longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  waypoint_name: z.string().min(1, 'Waypoint name is required').trim(),
  waypoint_description: z.string().min(1, 'Waypoint description is required').trim(),
  challenge_description: z.string().optional(),
  challenge_answer: z.string().optional(),
});

// Request validation schemas
export const createWaypointSequenceSchema = z.object({
  body: z.object({
    waypoint_name: waypointNameSchema,
    waypoint_description: waypointDescriptionSchema,
    data: z.array(waypointSchema).min(1, 'At least one waypoint is required'),
  }),
});

export const updateWaypointSequenceSchema = z.object({
  params: z.object({
    waypoint_name: waypointNameSchema,
  }),
  body: z.object({
    waypoint_name: waypointNameSchema,
    waypoint_description: waypointDescriptionSchema,
    data: z.array(waypointSchema).min(1, 'At least one waypoint is required'),
  }),
});

export const deleteWaypointSequenceSchema = z.object({
  params: z.object({
    waypoint_name: waypointNameSchema,
  }),
});

export const getWaypointSequenceSchema = z.object({
  params: z.object({
    waypoint_name: waypointNameSchema,
  }),
});

export const listWaypointSequencesSchema = z.object({
  query: z
    .object({
      includeDeleted: z.coerce.boolean().optional(),
      waypoint_name: z.string().optional(),
    })
    .optional(),
});

// Export inferred types
export type CreateWaypointSequenceInput = z.infer<typeof createWaypointSequenceSchema>['body'];
export type UpdateWaypointSequenceInput = z.infer<typeof updateWaypointSequenceSchema>['body'];
export type WaypointInput = z.infer<typeof waypointSchema>;