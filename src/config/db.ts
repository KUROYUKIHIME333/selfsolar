import postgres from "postgres";
import { env } from "./env.js";

const isSupabase = env.DATA_BASE_USED === "postgresql_supabase";

const connectionString = !isSupabase
  ? `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`
  : env.SUPABASE_DB_URL;

//TODO: retirer après debuging
if (!connectionString) {
  throw new Error(
    "La variable d'environnement de connexion à la base de données est manquante."
  );
}

export const sql = postgres(connectionString, {
  connect_timeout: 10,
  ssl: isSupabase ? "require" : false,
});
