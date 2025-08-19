import bcrypt from 'bcrypt';
import { getClient } from '../database';

export interface User {
  user_id: number;
  username: string;
  password_hash: string;
  nickname: string;
  roles: string[];
  valid_from: Date;
  valid_until?: Date;
}

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

  static async create(userData: CreateUserData): Promise<User> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const passwordHash = await this.hashPassword(userData.password);
      
      const result = await client.query(`
        INSERT INTO users (username, password_hash, nickname, roles)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id, username, password_hash, nickname, roles, valid_from, valid_until
      `, [userData.username, passwordHash, userData.nickname, userData.roles]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findActiveByUsername(username: string): Promise<User | null> {
    const client = await getClient();
    try {
      const result = await client.query(`
        SELECT user_id, username, password_hash, nickname, roles, valid_from, valid_until
        FROM users
        WHERE username = $1 AND valid_until IS NULL
      `, [username]);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  static async update(username: string, userData: UpdateUserData): Promise<User> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Find current active record
      const currentUser = await this.findActiveByUsername(username);
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Check if any changes are needed
      const passwordHash = userData.password 
        ? await this.hashPassword(userData.password)
        : currentUser.password_hash;

      const hasChanges = currentUser.nickname !== userData.nickname ||
                        JSON.stringify(currentUser.roles.sort()) !== JSON.stringify(userData.roles.sort()) ||
                        (userData.password && !(await this.verifyPassword(userData.password, currentUser.password_hash)));

      if (!hasChanges) {
        await client.query('ROLLBACK');
        throw new Error('No change required');
      }

      // Mark current record as invalid (temporal delete)
      await client.query(`
        UPDATE users 
        SET valid_until = CURRENT_TIMESTAMP
        WHERE username = $1 AND valid_until IS NULL
      `, [username]);

      // Insert new record (temporal insert)
      const result = await client.query(`
        INSERT INTO users (username, password_hash, nickname, roles)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id, username, password_hash, nickname, roles, valid_from, valid_until
      `, [userData.username, passwordHash, userData.nickname, userData.roles]);

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async delete(username: string): Promise<void> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE users 
        SET valid_until = CURRENT_TIMESTAMP
        WHERE username = $1 AND valid_until IS NULL
      `, [username]);

      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAllActive(): Promise<User[]> {
    const client = await getClient();
    try {
      const result = await client.query(`
        SELECT user_id, username, password_hash, nickname, roles, valid_from, valid_until
        FROM users
        WHERE valid_until IS NULL
        ORDER BY username
      `);

      return result.rows;
    } finally {
      client.release();
    }
  }
}