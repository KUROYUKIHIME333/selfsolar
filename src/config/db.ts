import postgres from "postgres";
import { env } from "./env.js";

const isSupabase = env.DATA_BASE_USED === "postgresql_supabase";

const connectionString = !isSupabase
  ? `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`
  : env.SUPABASE_DB_URL;

export const sql = postgres(connectionString, {
  ssl: isSupabase ? "require" : false,
});
