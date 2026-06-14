import postgres from "postgres";
import { env } from "./env.js";

// Constants for data base used
const useSupabaseDb = env.DATA_BASE_USED === "postgresql_supabase";
const useLocalPostgresqlDb = env.DATA_BASE_USED === "postgresql_local";

// Database URL for local PostgreSQL database
const clientUrl: string = useLocalPostgresqlDb
  ? `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`
  : env.SUPABASE_DB_URL;

// Create a connection to the database using PostgreSQL
const db = postgres(clientUrl, {
  max: 15,
  ssl: useSupabaseDb ? "require" : false,
});

console.log(db);

export default db;
