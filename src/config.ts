import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  defaultAdmin: {
    username: string;
    password: string;
    nickname: string;
  };
}

const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Port to run the server on',
    default: parseInt(process.env.PORT || '3000', 10),
  })
  .option('node-env', {
    type: 'string',
    description: 'Node environment',
    default: process.env.NODE_ENV || 'development',
  })
  .parseSync();

export const config: Config = {
  port: argv.port,
  nodeEnv: argv['node-env'],
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'scavenger_hunt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin@local.domain',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Password1!',
    nickname: process.env.DEFAULT_ADMIN_NICKNAME || 'admin',
  },
};