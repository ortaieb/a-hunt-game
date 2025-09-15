// src/modules/user/user.model.ts
import bcrypt from 'bcrypt';
import { eq, isNull, and, desc, sql } from 'drizzle-orm';
import { db } from './../../shared/database';
import { users, User as DbUser } from '../../schema/users';

import { User, CreateUserData, UpdateUserData, UserFilters } from './user.types';
import { v7 as uuidv7 } from 'uuid';

export class UserModel {
  private static readonly TABLE = 'users';
  private static readonly SALT_ROUNDS = 12;

  static async findById(userId: string): Promise<DbUser | null> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.user_id, userId), isNull(users.valid_until)))
      .limit(1);

    return result[0] || null;
  }

  static async findByUsername(username: string): Promise<DbUser | null> {
    const result = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username.toLowerCase()), isNull(users.valid_until)))
      .limit(1);

    return result[0] || null;
  }

  static async list(filters: UserFilters): Promise<User[]> {
    console.log(`list users using filter: ${JSON.stringify(filters, null, 2)}`);
    return await db.select().from(users).where(isNull(users.valid_until));
  }

  static async create(userData: CreateUserData): Promise<DbUser> {
    const hashedPassword = await bcrypt.hash(userData.password, this.SALT_ROUNDS);

    const result = await db
      .insert(users)
      .values({
        user_id: uuidv7(),
        username: userData.username.toLowerCase(),
        password_hash: hashedPassword,
        nickname: userData.nickname,
        roles: userData.roles,
        valid_from: new Date(),
        valid_until: null,
      })
      .returning();

    if (!result[0]) {
      throw new Error('Failed to create user');
    }

    return result[0];
  }

  static async update(username: string, userData: UpdateUserData): Promise<DbUser> {
    return await db.transaction(async (tx) => {
      const now = new Date();

      // Find current active user
      const currentUser = await tx
        .select()
        .from(users)
        .where(and(eq(users.username, username.toLowerCase()), isNull(users.valid_until)))
        .limit(1);

      if (!currentUser[0]) {
        throw new Error('User not found');
      }

      // Mark current record as invalid
      await tx
        .update(users)
        .set({ valid_until: now })
        .where(and(eq(users.user_id, currentUser[0].user_id), isNull(users.valid_until)));

      // Prepare data for new record
      const newData: any = {
        username: userData.username.toLowerCase(),
        password_hash: currentUser[0].password_hash, // Keep existing by default
        nickname: userData.nickname,
        roles: userData.roles,
        valid_from: now,
      };

      // Hash new password if provided
      if (userData.password) {
        newData.password_hash = await bcrypt.hash(userData.password, this.SALT_ROUNDS);
      }

      // Insert new version
      const result = await tx.insert(users).values(newData).returning();

      if (!result[0]) {
        throw new Error('Failed to update user');
      }

      return result[0];
    });
  }

  static async delete(username: string): Promise<void> {
    const result = await db
      .update(users)
      .set({ valid_until: new Date() })
      .where(and(eq(users.username, username.toLowerCase()), isNull(users.valid_until)));

    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
  }

  /**
   * Get user history (all versions)
   */
  static async getHistory(username: string): Promise<DbUser[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .orderBy(desc(users.valid_from));
  }

  /**
   * Verify user password
   */
  static async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = await this.findByUsername(username);

    if (!user) {
      return false;
    }

    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Check if username exists (including deleted)
   */
  static async usernameExists(username: string): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.username, username.toLowerCase()), isNull(users.valid_until)));

    return result[0].count > 0;
  }
}
