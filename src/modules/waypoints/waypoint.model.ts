// src/modules/waypoints/waypoint.model.ts
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../../shared/database';
import { waypoints } from '../../schema/waypoints';
import {
  Waypoint,
  CreateWaypointSequenceData,
  UpdateWaypointSequenceData,
  WaypointSequenceFilters,
} from './waypoint.types';
import { NotFoundError, ValidationError } from '../../shared/types/errors';

export class WaypointModel {
  // Validate waypoint data structure
  static validateWaypoint(waypoint: Waypoint): string | null {
    if (typeof waypoint.waypoint_seq_id !== 'number' || waypoint.waypoint_seq_id < 1) {
      return 'waypoint_seq_id must be a positive number';
    }

    if (
      typeof waypoint.waypoint_latitude !== 'number' ||
      waypoint.waypoint_latitude < -90 ||
      waypoint.waypoint_latitude > 90
    ) {
      return 'waypoint_latitude must be a number between -90 and 90';
    }

    if (
      typeof waypoint.waypoint_longitude !== 'number' ||
      waypoint.waypoint_longitude < -180 ||
      waypoint.waypoint_longitude > 180
    ) {
      return 'waypoint_longitude must be a number between -180 and 180';
    }

    if (!waypoint.waypoint_name || waypoint.waypoint_name.trim().length === 0) {
      return 'waypoint_name is required';
    }

    if (!waypoint.waypoint_description || waypoint.waypoint_description.trim().length === 0) {
      return 'waypoint_description is required';
    }

    return null;
  }

  static async create(data: CreateWaypointSequenceData): Promise<uuid> {
    // Validate each waypoint in the data array
    for (const waypoint of data.data) {
      const validationError = this.validateWaypoint(waypoint);
      if (validationError) {
        throw new ValidationError(validationError);
      }
    }

    const [sequence] = await db
      .insert(waypoints)
      .values({
        waypoint_name: data.waypoint_name,
        waypoint_description: data.waypoint_description,
        data: data.data,
        valid_from: new Date(),
        valid_until: null,
      })
      .returning();

    if (!sequence) {
      throw new Error('Failed to create waypoint sequence');
    }

    return sequence;
  }

  static async update(waypointName: string, data: UpdateWaypointSequenceData): Promise<uuidv7> {
    // Validate each waypoint in the data array
    for (const waypoint of data.data) {
      const validationError = this.validateWaypoint(waypoint);
      if (validationError) {
        throw new ValidationError(validationError);
      }
    }

    // Check if the waypoint sequence exists
    const existingSequence = await this.findActiveByName(waypointName);
    if (!existingSequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    // Mark the current sequence as invalid
    await db
      .update(waypoints)
      .set({ valid_until: new Date() })
      .where(and(eq(waypoints.waypoint_name, waypointName), isNull(waypoints.valid_until)));

    // Create new version
    const [sequence] = await db
      .insert(waypoints)
      .values({
        waypoint_name: data.waypoint_name,
        waypoint_description: data.waypoint_description,
        data: data.data,
        valid_from: new Date(),
        valid_until: null,
      })
      .returning();

    if (!sequence) {
      throw new Error('Failed to update waypoint sequence');
    }

    return sequence;
  }

  static async delete(waypointName: string): Promise<void> {
    const existingSequence = await this.findActiveByName(waypointName);
    if (!existingSequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    await db
      .update(waypoints)
      .set({ valid_until: new Date() })
      .where(and(eq(waypoints.waypoint_name, waypointName), isNull(waypoints.valid_until)));
  }

  static async findActiveByName(waypointName: string): Promise<WaypointSequence | null> {
    const [sequence] = await db
      .select()
      .from(waypoints)
      .where(and(eq(waypoints.waypoint_name, waypointName), isNull(waypoints.valid_until)))
      .limit(1);

    return sequence || null;
  }

  static async getAllActive(): Promise<WaypointSequence[]> {
    return await db
      .select()
      .from(waypoints)
      .where(isNull(waypoints.valid_until))
      .orderBy(waypoints.waypoint_name);
  }

  static async list(filters: WaypointSequenceFilters): Promise<WaypointSequence[]> {
    let query = db.select().from(waypoints);

    if (!filters.includeDeleted) {
      query = query.where(isNull(waypoints.valid_until));
    }

    if (filters.waypoint_name) {
      query = query.where(eq(waypoints.waypoint_name, filters.waypoint_name));
    }

    return await query.orderBy(waypoints.waypoint_name);
  }

  static async waypointNameExists(waypointName: string): Promise<boolean> {
    const [result] = await db
      .select({ count: waypoints.waypoint_name })
      .from(waypoints)
      .where(eq(waypoints.waypoint_name, waypointName))
      .limit(1);

    return !!result;
  }
}
