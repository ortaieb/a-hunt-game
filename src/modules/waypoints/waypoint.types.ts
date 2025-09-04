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

// export interface WaypointSequenceFilters {
//   includeDeleted?: boolean;
//   waypoint_name?: string;
// }

// export interface WaypointSequenceSummary {
//   waypoints_id: string;
//   waypoint_name: string;
//   waypoint_description: string;
//   valid_from: Date;
// }
