import app from './app';
import { config } from './config';
import { initializeDatabase, closePool } from './database';
import { initializeDefaultAdmin } from './services/adminInit';

const startServer = async (): Promise<void> => {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    
    console.log('Initializing default admin user...');
    await initializeDefaultAdmin();
    
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });

    const gracefulShutdown = (signal: string): void => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await closePool();
          console.log('Database connections closed');
        } catch (error) {
          console.error('Error closing database connections:', error);
        }
        console.log('Process terminated');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();