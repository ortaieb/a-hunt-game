import {
  pgTable,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
  pgEnum,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const challenges = pgTable(
  'challenges',
  {
    challenge_id: uuid('challenge_id').notNull(),
    challenge_inst_id: uuid('challenge_instance_id').primaryKey(),
    challenge_name: varchar('challenge_name', { length: 60 }).notNull(),
    challenge_desc: text('challenge_desc').notNull(),
    waypoints: varchar('waypoints_ref', { length: 255 }).notNull(),
    start_time: timestamp('challenge_start_time', {
      withTimezone: true,
    }).notNull(),
    duration: integer('challenge_duration').notNull().default(90),
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    valid_until: timestamp('valid_until', { withTimezone: true }),
  },
  (table) => ({
    challangeActiveIdx: uniqueIndex('idx_challenges_challengeid_active')
      .on(table.challenge_id)
      .where(sql`${table.valid_until} IS NULL`),

    challangeNameUniqueIdx: uniqueIndex('idx_challenges_challengename')
      .on(table.challenge_name)
      .where(sql`${table.valid_until} IS NULL`),

    temporalIdx: index('idx_challenges_temporal').on(
      table.challenge_id,
      table.valid_from,
      table.valid_until,
    ),

    // Foreign key constraint is now defined directly on the waypoints column above
  }),
);

export const PARTICIPANT_STATES = ['PENDING', 'INVITED', 'ACCEPTED', 'REJECTED'] as const;

export const challengeParticipantState = pgEnum('participant_state', PARTICIPANT_STATES);
export type ChallengeParticipantState = (typeof PARTICIPANT_STATES)[number];

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    challenge_participant_id: uuid('challenge_participant_id').notNull(),
    challenge_participant_inst_id: uuid('challenge_participant_inst_id').primaryKey(),
    challenge_id: uuid('challenge_id').notNull(),
    username: varchar('username', { length: 60 }).notNull(),
    participant_name: varchar('participant_name', { length: 60 }).notNull(),
    state: challengeParticipantState('participant_state').notNull(),
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    valid_until: timestamp('valid_until', { withTimezone: true }),
  },
  (table) => ({
    challangeParticipantActiveIdx: uniqueIndex(
      'idx_challenges_participant_challengeparticipantid_active',
    )
      .on(table.challenge_participant_id)
      .where(sql`${table.valid_until} IS NULL`),

    temporalIdx: index('idx_challenge_participants_temporal').on(
      table.challenge_participant_id,
      table.valid_from,
      table.valid_until,
    ),
  }),
);

export type Challenge = typeof challenges.$inferSelect;
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
