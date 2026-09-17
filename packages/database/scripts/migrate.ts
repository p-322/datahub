import {migrate} from 'drizzle-orm/postgres-js/migrator';
import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {env, exit} from 'node:process';

// A dedicated single connection for migrations (the app pool is not needed here).
async function runMigrations() {
  const client = postgres(env['DATABASE_URL'] as string, {max: 1});
  try {
    await migrate(drizzle(client), {migrationsFolder: './migrations'});
    await client.end();
    exit(0);
  } catch (err) {
    console.error(err);
    await client.end();
    exit(1);
  }
}

runMigrations();
