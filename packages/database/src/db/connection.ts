// Sawubona: Postgres on Discovery One (was mysql2 / PlanetScale).
// postgres-js parses DATABASE_URL at construction but does not connect until
// the first query, so importing this module without a reachable database is
// harmless (the image build and `verify-image.sh` rely on that).
import {drizzle} from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import {env} from 'node:process';

if (!env['DATABASE_URL']) {
  throw new Error('`DATABASE_URL` environment variable is not set');
}

const client = postgres(env['DATABASE_URL'], {
  // One Next.js server on Enterprise; Discovery One is a small cx23.
  max: 5,
});

export const db = drizzle(client, {schema});
