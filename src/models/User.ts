import bcrypt from 'bcrypt';
import { eq, isNull, and } from 'drizzle-orm';
import { getDb } from '../db';
import { users, type User } from '../schema/users';

export interface CreateUserData {
  username: string;
  password: string;
  nickname: string;
  roles: string[];
}

export interface UpdateUserData {
  username: string;
  password?: string;
  nickname: string;
  roles: string[];
}

export class UserModel {
  private static readonly SALT_ROUNDS = 12;

  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  static async create(userData: CreateUserData): Promise<User | null> {
    // const db = getDb();
    // const passwordHash = await this.hashPassword(userData.password);
    // const [newUser] = await db
    //   .insert(users)
    //   .values({
    //     username: userData.username,
    //     password_hash: passwordHash,
    //     nickname: userData.nickname,
    //     roles: userData.roles,
    //   })
    //   .returning();
    // return newUser;
    //
    console.log('userData: ' + userData);
    return null;
  }

  static async findActiveByUsername(username: string): Promise<User | null> {
    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.username, username), isNull(users.valid_until)))
      .limit(1);

    return user || null;
  }

  static async update(username: string, userData: UpdateUserData): Promise<User | null> {
    // const db = getDb();

    // return await db.transaction(async (tx) => {
    //   // Find current active record
    //   const [currentUser] = await tx
    //     .select()
    //     .from(users)
    //     .where(and(eq(users.username, username), isNull(users.valid_until)))
    //     .limit(1);

    //   if (!currentUser) {
    //     throw new Error('User not found');
    //   }

    //   // Check if any changes are needed
    //   const passwordHash = userData.password
    //     ? await this.hashPassword(userData.password)
    //     : currentUser.password_hash;

    //   const hasChanges =
    //     currentUser.nickname !== userData.nickname ||
    //     JSON.stringify(currentUser.roles.sort()) !== JSON.stringify(userData.roles.sort()) ||
    //     (userData.password &&
    //       !(await this.verifyPassword(userData.password, currentUser.password_hash)));

    //   if (!hasChanges) {
    //     throw new Error('No change required');
    //   }

    //   // Mark current record as invalid (temporal delete)
    //   await tx
    //     .update(users)
    //     .set({ valid_until: new Date() })
    //     .where(and(eq(users.username, username), isNull(users.valid_until)));

    //   // Insert new record (temporal insert)
    //   const [updatedUser] = await tx
    //     .insert(users)
    //     .values({
    //       username: userData.username,
    //       password_hash: passwordHash,
    //       nickname: userData.nickname,
    //       roles: userData.roles,
    //     })
    //     .returning();

    //   return updatedUser;
    // });
    console.log('username: ' + username);
    console.log('userData: ' + userData);
    return null;
  }

  static async delete(username: string): Promise<void> {
    const db = getDb();

    const [result] = await db
      .update(users)
      .set({ valid_until: new Date() })
      .where(and(eq(users.username, username), isNull(users.valid_until)))
      .returning({ user_id: users.user_id });

    if (!result) {
      throw new Error('User not found');
    }
  }

  static async getAllActive(): Promise<User[]> {
    const db = getDb();

    return await db.select().from(users).where(isNull(users.valid_until)).orderBy(users.username);
  }
}
