import { ConflictError } from '../shared/types/errors';
import { userService } from '../modules/users/user.service';
import { CreateUserInput } from '../modules/users/user.validator';

export const initializeDefaultAdmin = async (): Promise<void> => {
  try {
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin@local.domain';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Password1!';
    const defaultNickname = process.env.DEFAULT_ADMIN_NICKNAME || 'admin';

    console.log('Creating default admin user...');

    const input: CreateUserInput = {
      username: defaultUsername,
      password: defaultPassword,
      nickname: defaultNickname,
      roles: ['game.admin'],
    };
    await userService.createUser(input);

    console.log(`Default admin user created: ${defaultUsername}`);
  } catch (error) {
    if (error instanceof ConflictError) {
      // admin user already exists
      console.log('noop, admin user already exists (message:' + error.message + ')');
    } else {
      console.error('Error initializing default admin user:', error);
      throw error;
    }
  }
};
