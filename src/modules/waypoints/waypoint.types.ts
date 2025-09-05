// src/modules/waypoints/waypoint.types.ts
import type { Waypoint as DbWaypoint } from '../../schema/waypoints';

// Re-export the database types
export type Waypoint = DbWaypoint;

export interface CreateWaypointSequenceData {
  waypoint_name: string;
  waypoint_description: string;
  data: Waypoint[];
}

export interface UpdateWaypointSequenceData {
  waypoint_name: string;
  waypoint_description: string;
  data: Waypoint[];
}
