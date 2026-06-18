import { betterAuth } from "better-auth";
import { env } from "./env.js";
import pool from "./db.js";

export const auth = betterAuth({
  databaseProvider: "pg",
  database: pool,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || "http://localhost:5001",

  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },

  hooks: {
    after: async (ctx) => {
      const body = ctx.body as unknown as Record<string, any>;
      const url = ctx.request?.url || "";
      const user =
        (ctx as any).context?.returned?.user || (ctx as any).result?.user;

      if (url.includes("/sign-up/email") && user) {
        try {
          await pool.query(
            `INSERT INTO profiles (id, email, username)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO NOTHING`,
            [user.id, user.email.toLowerCase(), body?.name || null]
          );
        } catch (error) {
          console.error("Erreur lors de la création du profil :", error);
        }
      }
    },
  },
});
