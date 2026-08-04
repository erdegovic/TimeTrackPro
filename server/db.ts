import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool: PgPool } = pg;

// Check for database URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

const poolOptions = {
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// A regular PostgreSQL connection works with local Postgres, Supabase, and Neon.
export const pool = new PgPool(poolOptions);
export const db = drizzlePg(pool, { schema });
