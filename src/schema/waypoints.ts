import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  json,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { Expose } from 'class-transformer';
import 'reflect-metadata';

// GeoLocation interface for type safety
export interface GeoLocation {
  lat: number;
  long: number;
}

// Waypoint class with class-transformer decorators for JSON serialization
export class Waypoint {
  @Expose({ name: 'waypoint-seq-id' })
  waypoint_seq_id: number;

  location: GeoLocation;
  radius: number;
  clue: string;
  hints: string[];

  @Expose({ name: 'image-subject' })
  image_subject: string;

  constructor() {
    this.waypoint_seq_id = 0;
    this.location = { lat: 0, long: 0 };
    this.radius = 0;
    this.clue = '';
    this.hints = [];
    this.image_subject = '';
  }
}

// Waypoints table schema - stores sequences of waypoints as JSON
export const waypoints = pgTable(
  'waypoints',
  {
    waypoints_id: uuid('waypoints_id').primaryKey(),
    waypoint_name: varchar('waypoint_name', { length: 255 }).notNull(),
    waypoint_description: text('waypoint_description').notNull(),
    data: json('data').$type<Waypoint[]>().notNull(), // JSON array of waypoints
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    valid_until: timestamp('valid_until', { withTimezone: true }),
  },
  (table) => ({
    // Temporal constraint for active waypoint sequences
    waypointNameActiveIdx: uniqueIndex('idx_waypoints_name_active')
      .on(table.waypoint_name)
      .where(sql`${table.valid_until} IS NULL`),

    // Temporal query optimization
    temporalIdx: index('idx_waypoints_temporal').on(
      table.waypoint_name,
      table.valid_from,
      table.valid_until,
    ),
  }),
);

// WaypointSummary class for summary endpoint response with class-transformer decorators
export class WaypointSummary {
  @Expose({ name: 'waypoint-name' })
  waypoint_name: string;

  @Expose({ name: 'waypoint-description' })
  waypoint_description: string;

  constructor() {
    this.waypoint_name = '';
    this.waypoint_description = '';
  }
}
