// src/scripts/migrate.ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '../shared/database';

async function runMigrations(): Promise<void> {
  console.log('Running migrations...');

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Migrations completed!');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
