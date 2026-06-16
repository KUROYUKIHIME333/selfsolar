import { Pool } from "pg";
import { env } from "./env.js";

const isSupabase = env.DATA_BASE_USED === "postgresql_supabase";

const pool: Pool = isSupabase
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
    });

// pool.on("connect", () => {
//   console.log("CONNECTION APP --- DB ETABLIE");
// });

pool.on("error", (err) => {
  console.error("Erreur inattendue sur la connection avec la db: ", err);
});

export default pool;
