import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000, // Neon wakes from idle in about a second, so allow for it
    ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool;
