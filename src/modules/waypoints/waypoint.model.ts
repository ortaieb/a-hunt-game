// src/modules/waypoints/waypoint.model.ts
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../../shared/database';
import { waypoints, WaypointsRecord } from '../../schema/waypoints';
import { CreateWaypointSequenceData, UpdateWaypointSequenceData } from './waypoint.types';
import { NotFoundError } from '../../shared/types/errors';
import { v7 as uuidv7 } from 'uuid';

export class WaypointModel {
  static async create(data: CreateWaypointSequenceData): Promise<WaypointsRecord> {
    const result = await db
      .insert(waypoints)
      .values({
        waypoints_id: uuidv7(),
        waypoint_name: data.waypoint_name.toLowerCase(),
        waypoint_description: data.waypoint_description,
        data: data.data,
        valid_from: new Date(),
        valid_until: null,
      })
      .returning();

    if (!result[0]) {
      throw new Error('Failed to create waypoints sequence');
    }

    return result[0];
  }

  static async update(
    waypointName: string,
    data: UpdateWaypointSequenceData,
  ): Promise<WaypointsRecord> {
    return await db.transaction(async tx => {
      const now = new Date();

      const currentRecord = await tx
        .select()
        .from(waypoints)
        .where(
          and(
            eq(waypoints.waypoint_name, waypointName.toLowerCase()),
            isNull(waypoints.valid_until),
          ),
        )
        .limit(1);
      if (!currentRecord[0]) {
        throw new Error('User not found');
      }

      await tx
        .update(waypoints)
        .set({ valid_until: now })
        .where(
          and(
            eq(waypoints.waypoints_id, currentRecord[0].waypoints_id),
            isNull(waypoints.valid_until),
          ),
        );

      var newData: any = {
        waypoints_id: uuidv7(),
        waypoint_name: data.waypoint_name,
        waypoint_description: data.waypoint_description,
        data: data.data,
        valid_from: now,
        valid_until: null,
      };

      const result = await tx.insert(waypoints).values(newData).returning();

      if (!result[0]) {
        throw new Error('Failed to update user');
      }

      return result[0];
    });
  }

  static async delete(waypointName: string): Promise<void> {
    const existingSequence = await this.findByName(waypointName);
    if (!existingSequence) {
      throw new NotFoundError('Waypoint sequence not found');
    }

    await db
      .update(waypoints)
      .set({ valid_until: new Date() })
      .where(and(eq(waypoints.waypoint_name, waypointName), isNull(waypoints.valid_until)));
  }

  static async findByName(waypointName: string): Promise<WaypointsRecord | null> {
    const [sequence] = await db
      .select()
      .from(waypoints)
      .where(and(eq(waypoints.waypoint_name, waypointName), isNull(waypoints.valid_until)))
      .limit(1);

    return sequence || null;
  }

  // static async getAllActive(): Promise<WaypointsRecord> {
  //   return await db
  //     .select()
  //     .from(waypoints)
  //     .where(isNull(waypoints.valid_until))
  //     .orderBy(waypoints.waypoint_name);
  // }

  // static async list(filters: WaypointSequenceFilters): Promise<WaypointSequence[]> {
  //   let query = db.select().from(waypoints);

  //   if (!filters.includeDeleted) {
  //     query = query.where(isNull(waypoints.valid_until));
  //   }

  //   if (filters.waypoint_name) {
  //     query = query.where(eq(waypoints.waypoint_name, filters.waypoint_name));
  //   }

  //   return await query.orderBy(waypoints.waypoint_name);
  // }

  static async waypointNameExists(waypointName: string): Promise<boolean> {
    const [result] = await db
      .select({ count: waypoints.waypoint_name })
      .from(waypoints)
      .where(eq(waypoints.waypoint_name, waypointName))
      .limit(1);

    return !!result;
  }
}
