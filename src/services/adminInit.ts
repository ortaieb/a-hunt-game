import { UserModel } from '../models/User';

export const initializeDefaultAdmin = async (): Promise<void> => {
  try {
    const defaultUsername =
      process.env.DEFAULT_ADMIN_USERNAME || 'admin@local.domain';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Password1!';
    const defaultNickname = process.env.DEFAULT_ADMIN_NICKNAME || 'admin';

    const existingAdmin = await UserModel.findActiveByUsername(defaultUsername);

    if (!existingAdmin) {
      console.log('Creating default admin user...');

      await UserModel.create({
        username: defaultUsername,
        password: defaultPassword,
        nickname: defaultNickname,
        roles: ['game.admin'],
      });

      console.log(`Default admin user created: ${defaultUsername}`);
    } else {
      console.log('Default admin user already exists');
    }
  } catch (error) {
    console.error('Error initializing default admin user:', error);
    throw error;
  }
};
