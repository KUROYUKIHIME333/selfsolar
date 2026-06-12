import postgres from "postgres";
import { env } from "./env.js";

const useSupabaseDb: boolean = env.DATA_BASE_USED === "postgresql_supabase";
const useLocalPostgresqlDb: boolean = env.DATA_BASE_USED === "postgresql_local";

const clientUrl: string = useLocalPostgresqlDb
  ? `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`
  : env.SUPABASE_DB_URL;

const queryClient = postgres(clientUrl, {
  max: 15,
  ssl: useSupabaseDb ? "require" : false,
});

export const db = queryClient;
