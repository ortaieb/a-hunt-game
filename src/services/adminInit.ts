import { UserModel } from '../models/UserDrizzle';
import { config } from '../config';

export const initializeDefaultAdmin = async (): Promise<void> => {
  try {
    const existingAdmin = await UserModel.findActiveByUsername(config.defaultAdmin.username);
    
    if (!existingAdmin) {
      console.log('Creating default admin user...');
      
      await UserModel.create({
        username: config.defaultAdmin.username,
        password: config.defaultAdmin.password,
        nickname: config.defaultAdmin.nickname,
        roles: ['game.admin'],
      });
      
      console.log(`Default admin user created: ${config.defaultAdmin.username}`);
    } else {
      console.log('Default admin user already exists');
    }
  } catch (error) {
    console.error('Error initializing default admin user:', error);
    throw error;
  }
};