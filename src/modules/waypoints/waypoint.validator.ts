import { z } from 'zod';

// Reusable schemas
const waypointNameSchema = z
  .string()
  .min(1, 'Waypoint name is required')
  .max(255, 'Waypoint name must be 255 characters or less')
  .trim();

const waypointDescriptionSchema = z.string().min(1, 'Waypoint description is required').trim();

// GeoLocation record
const geoLocationSchema = z.object({
  lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  long: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
});

// Individual waypoint schema (matching schema/waypoints.ts structure)
const waypointSchema = z.object({
  waypoint_seq_id: z.number().int().positive('Waypoint sequence ID must be a positive number'),
  location: geoLocationSchema,
  radius: z.number().int().positive('Radius must be positive integer'),
  clue: z.string().nonempty('Clue must have meaningful description').trim(),
  hints: z.array(z.string().nonempty()).optional(),
  image_subject: z.string().min(1, 'image subject must be meaningful description').trim(),
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
