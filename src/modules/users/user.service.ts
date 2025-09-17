// src/modules/user/user.service.ts
import bcrypt from 'bcrypt';
import { UserModel } from './user.model';
import { CreateUserInput, UpdateUserInput } from './user.validator';
import { User, UserResponse, UserFilters } from './user.types';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/types/errors';

export class UserService {
  /**
   * Transform user for API response (remove password_hash)
   */
  private toResponse(user: User): UserResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, ...userResponse } = user;
    return userResponse;
  }

  async createUser(data: CreateUserInput): Promise<UserResponse> {
    // Check if user exists (including deleted ones)
    const exists = await UserModel.usernameExists(data.username);
    if (exists) {
      // Check if it's deleted
      const activeUser = await UserModel.findByUsername(data.username);
      if (activeUser) {
        throw new ConflictError('User already exists');
      } else {
        throw new ConflictError('Username previously used. Please choose another.');
      }
    }

    const user = await UserModel.create(data);
    return this.toResponse(user);
  }

  async updateUser(username: string, data: UpdateUserInput): Promise<UserResponse> {
    if (username !== data.username) {
      throw new ValidationError('URL username must match body username');
    }

    const existingUser = await UserModel.findByUsername(username);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    const user = await UserModel.update(username, data);
    return this.toResponse(user);
  }

  async deleteUser(username: string): Promise<void> {
    const existingUser = await UserModel.findByUsername(username);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    return UserModel.delete(username);
  }

  async getUser(username: string): Promise<User> {
    const user = await UserModel.findByUsername(username);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async validateUser(user: User, password: string): Promise<UserResponse> {
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) throw new UnauthorizedError('Invalid credentials');

    return this.toResponse(user);
  }

  async listUsers(filters: UserFilters): Promise<UserResponse[]> {
    const users = await UserModel.list(filters);
    return users.map(user => this.toResponse(user));
  }

  async getUserHistory(username: string): Promise<UserResponse[]> {
    const history = await UserModel.getHistory(username);
    if (history.length === 0) {
      throw new NotFoundError('User not found');
    }
    return history.map(user => this.toResponse(user));
  }
}

export const userService = new UserService();
