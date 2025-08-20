import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  json,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// GeoLocation interface for type safety
export interface GeoLocation {
  lat: number;
  long: number;
}

// Waypoint interface representing individual waypoint in a sequence
export interface Waypoint {
  waypoint_seq_id: number;
  location: GeoLocation;
  radius: number;
  clue: string;
  hints: string[];
  image_subject: string;
}

// Waypoints table schema - stores sequences of waypoints as JSON
export const waypoints = pgTable(
  "waypoints",
  {
    waypoints_id: serial("waypoints_id").primaryKey(),
    waypoint_name: varchar("waypoint_name", { length: 255 }).notNull(),
    waypoint_description: text("waypoint_description").notNull(),
    data: json("data").$type<Waypoint[]>().notNull(), // JSON array of waypoints
    valid_from: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    valid_until: timestamp("valid_until", { withTimezone: true }),
  },
  (table) => ({
    // Temporal constraint for active waypoint sequences
    waypointNameActiveIdx: uniqueIndex("idx_waypoints_name_active")
      .on(table.waypoint_name)
      .where(sql`${table.valid_until} IS NULL`),

    // Temporal query optimization
    temporalIdx: index("idx_waypoints_temporal").on(
      table.waypoint_name,
      table.valid_from,
      table.valid_until,
    ),
  }),
);

export type WaypointSequence = typeof waypoints.$inferSelect;
export type NewWaypointSequence = typeof waypoints.$inferInsert;
