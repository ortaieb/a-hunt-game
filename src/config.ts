import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
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
};