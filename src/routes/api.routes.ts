import { FastifyInstance } from "fastify";
import { installationPhotovoltaiqueRoutes } from "./routesFiles/installationPhotovoltaique.routes.js";
import { usersRoutes } from "./routesFiles/users.routes.js";

export const apiRoutes = async (app: FastifyInstance) => {
  // Routes PV sous préfixe /api/v1/pv
  app.register(installationPhotovoltaiqueRoutes, { prefix: "/api/v1/pv" });
  app.register(usersRoutes, { prefix: "/use" });
};
