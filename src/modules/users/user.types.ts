// src/modules/user/user.types.ts
import type { User as DbUser } from '../../schema/users';

// Re-export the database user type
export type User = DbUser;

// Transform for API responses (hiding password_hash)
export type UserResponse = Omit<User, 'password_hash'>;

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

export interface UserFilters {
  includeDeleted?: boolean;
  role?: string;
}
