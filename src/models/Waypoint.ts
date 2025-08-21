import { eq, isNull, and } from 'drizzle-orm';
import { getDb } from '../db';
import {
  waypoints,
  type WaypointSequence,
  type Waypoint,
} from '../schema/waypoints';

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

export class WaypointModel {
  // Validate waypoint data structure
  static validateWaypoint(waypoint: Waypoint): string | null {
    if (
      typeof waypoint.waypoint_seq_id !== 'number' ||
      waypoint.waypoint_seq_id < 1
    ) {
      return 'waypoint_seq_id must be a positive number';
    }

    if (
      !waypoint.location ||
      typeof waypoint.location.lat !== 'number' ||
      typeof waypoint.location.long !== 'number'
    ) {
      return 'location must have valid lat and long coordinates';
    }

    if (typeof waypoint.radius !== 'number' || waypoint.radius <= 0) {
      return 'radius must be a positive number';
    }

    if (!waypoint.clue || typeof waypoint.clue !== 'string') {
      return 'clue must be a non-empty string';
    }

    if (
      !Array.isArray(waypoint.hints) ||
      !waypoint.hints.every((hint) => typeof hint === 'string')
    ) {
      return 'hints must be an array of strings';
    }

    if (!waypoint.image_subject || typeof waypoint.image_subject !== 'string') {
      return 'image_subject must be a non-empty string';
    }

    return null;
  }

  // Validate complete waypoint sequence
  static validateWaypointSequence(data: Waypoint[]): string | null {
    if (!Array.isArray(data) || data.length === 0) {
      return 'data must be a non-empty array of waypoints';
    }

    // Check each waypoint
    for (const waypoint of data) {
      const error = this.validateWaypoint(waypoint);
      if (error) {
        return error;
      }
    }

    // Check sequence IDs are consecutive starting from 1
    const sortedWaypoints = [...data].sort(
      (a, b) => a.waypoint_seq_id - b.waypoint_seq_id,
    );
    for (let i = 0; i < sortedWaypoints.length; i++) {
      if (sortedWaypoints[i].waypoint_seq_id !== i + 1) {
        return 'waypoint_seq_id must be consecutive starting from 1';
      }
    }

    return null;
  }

  static async create(
    waypointData: CreateWaypointSequenceData,
  ): Promise<WaypointSequence> {
    const db = getDb();

    // Validate waypoint sequence
    const validationError = this.validateWaypointSequence(waypointData.data);
    if (validationError) {
      throw new Error(validationError);
    }

    const [newWaypointSequence] = await db
      .insert(waypoints)
      .values({
        waypoint_name: waypointData.waypoint_name,
        waypoint_description: waypointData.waypoint_description,
        data: waypointData.data,
      })
      .returning();

    return newWaypointSequence;
  }

  static async findActiveByName(
    waypoint_name: string,
  ): Promise<WaypointSequence | null> {
    const db = getDb();

    const [waypointSequence] = await db
      .select()
      .from(waypoints)
      .where(
        and(
          eq(waypoints.waypoint_name, waypoint_name),
          isNull(waypoints.valid_until),
        ),
      )
      .limit(1);

    return waypointSequence || null;
  }

  static async findActiveById(
    waypoints_id: number,
  ): Promise<WaypointSequence | null> {
    const db = getDb();

    const [waypointSequence] = await db
      .select()
      .from(waypoints)
      .where(
        and(
          eq(waypoints.waypoints_id, waypoints_id),
          isNull(waypoints.valid_until),
        ),
      )
      .limit(1);

    return waypointSequence || null;
  }

  static async update(
    waypoint_name: string,
    waypointData: UpdateWaypointSequenceData,
  ): Promise<WaypointSequence> {
    const db = getDb();

    // Validate waypoint sequence
    const validationError = this.validateWaypointSequence(waypointData.data);
    if (validationError) {
      throw new Error(validationError);
    }

    return await db.transaction(async (tx) => {
      // Find current active record
      const [currentWaypoint] = await tx
        .select()
        .from(waypoints)
        .where(
          and(
            eq(waypoints.waypoint_name, waypoint_name),
            isNull(waypoints.valid_until),
          ),
        )
        .limit(1);

      if (!currentWaypoint) {
        throw new Error('Waypoint sequence not found');
      }

      // Check if any changes are needed
      const hasChanges =
        currentWaypoint.waypoint_description !==
          waypointData.waypoint_description ||
        JSON.stringify(currentWaypoint.data) !==
          JSON.stringify(waypointData.data) ||
        currentWaypoint.waypoint_name !== waypointData.waypoint_name;

      if (!hasChanges) {
        throw new Error('No change required');
      }

      // Mark current record as invalid (temporal delete)
      await tx
        .update(waypoints)
        .set({ valid_until: new Date() })
        .where(
          and(
            eq(waypoints.waypoint_name, waypoint_name),
            isNull(waypoints.valid_until),
          ),
        );

      // Insert new record (temporal insert)
      const [updatedWaypoint] = await tx
        .insert(waypoints)
        .values({
          waypoint_name: waypointData.waypoint_name,
          waypoint_description: waypointData.waypoint_description,
          data: waypointData.data,
        })
        .returning();

      return updatedWaypoint;
    });
  }

  static async delete(waypoint_name: string): Promise<void> {
    const db = getDb();

    const [result] = await db
      .update(waypoints)
      .set({ valid_until: new Date() })
      .where(
        and(
          eq(waypoints.waypoint_name, waypoint_name),
          isNull(waypoints.valid_until),
        ),
      )
      .returning({ waypoints_id: waypoints.waypoints_id });

    if (!result) {
      throw new Error('Waypoint sequence not found');
    }
  }

  static async getAllActive(): Promise<WaypointSequence[]> {
    const db = getDb();

    return await db
      .select()
      .from(waypoints)
      .where(isNull(waypoints.valid_until))
      .orderBy(waypoints.waypoint_name);
  }
}