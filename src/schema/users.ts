import { pgTable, varchar, text, timestamp, uniqueIndex, index, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    user_id: uuid('user_id').primaryKey(),
    username: varchar('username', { length: 255 }).notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    nickname: varchar('nickname', { length: 255 }).notNull(),
    roles: text('roles')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    valid_from: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    valid_until: timestamp('valid_until', { withTimezone: true }),
  },
  (table) => ({
    // Temporal constraint for active users
    usernameActiveIdx: uniqueIndex('idx_users_username_active')
      .on(table.username)
      .where(sql`${table.valid_until} IS NULL`),

    // Temporal query optimization
    temporalIdx: index('idx_users_temporal').on(
      table.username,
      table.valid_from,
      table.valid_until,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
