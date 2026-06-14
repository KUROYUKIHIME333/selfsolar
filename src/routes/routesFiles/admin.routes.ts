import { FastifyInstance } from "fastify";
import { adminController } from "../../controllers/admin.controllers.js";

export const adminRoutes = async (
  app: FastifyInstance
) => {
  // app.post("/plan-souscription", {
  // })
  app.post("/inscription", {
    handler: adminController.createNewUser.bind(adminController),
  });
};
