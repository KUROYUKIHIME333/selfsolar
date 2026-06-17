import { betterAuth } from "better-auth";
import { env, IS_SUPABASE } from "./env.js";
import { Pool } from "pg";

export const auth = betterAuth({
  databaseProvider: "pg",

  database: IS_SUPABASE
    ? new Pool({
        connectionString: env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false },
      })
    : new Pool({
        host: env.LOCAL_POSTGRES_HOST,
        port: env.LOCAL_POSTGRES_PORT,
        user: env.LOCAL_POSTGRES_USER,
        password: env.LOCAL_POSTGRES_PASSWORD,
        database: env.LOCAL_POSTGRES_DB,
      }),
});
