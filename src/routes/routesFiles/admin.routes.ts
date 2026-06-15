import { FastifyInstance } from "fastify";
//import { adminController } from "../../controllers/admin.controllers.js";
import { db } from "../../config/db.js";

export const adminRoutes = async (app: FastifyInstance) => {
  // app.post("/plan-souscription", {
  // })
  app.post("/inscription", {
    handler: async () => {
      const response =
        await db`INSERT INTO profils (id, profile_picture, email, password) VALUES (gen_random_uuid(), null, 'eaaili@gmail', '7680f32c08d1a67d5a603c047280') RETURNING (id, email, profile_picture, username, company_name, created_at, updated_at);`;

      //TODO: Remove it when finishing working or debugging
      console.log("----------------------------------");
      console.log("CRESULT OF REQUEST IN THE CONTROLLER");
      console.log("----------------------------------");
      console.log("CREATION: ", response);
      console.log("----------------------------------");
      console.log("----------------------------------");

      return response;
    },
  });
};
