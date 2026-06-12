import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  CORS_ORIGIN: z.string().default(""),
  PORT: z.preprocess((val) => Number(val), z.number().default(5001)),
  HOST: z.string().default("0.0.0.0"),
  PVGIS_URL: z.string().default("https://re.jrc.ec.europa.eu/api/v5_2/"),
  API_URL: z.string().default("https://selfsolar-1.onrender.com/"),

  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.preprocess((val) => Number(val), z.number().default(5432)),
  POSTGRES_DB: z.string(),
});

// Extraire le type pour TypeScript
export type Env = z.infer<typeof envSchema>;

// Valider au démarrage
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Variables d'environnement manquantes ou invalides ! Vérifier .env",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
  );
  process.exit(1); // Arrêter le serveur tout de suite
}

export const env = parsed.data;
