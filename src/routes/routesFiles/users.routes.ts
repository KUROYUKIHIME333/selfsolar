import { FastifyInstance } from "fastify";
//import { adminController } from "../../controllers/admin.controllers.js";
import { userController } from "../../controllers/users.controllers.js";

export const usersRoutes = async (app: FastifyInstance) => {
  // app.post("/plan-souscription", {
  // })
  app.post("/inscription", {
    handler: userController.creerNouveauProfile.bind(userController),
  });

  app.put("/:id", {
    handler: userController.modifierUtilisateurExistant.bind(userController),
  });

  app.get("/:id", {
    handler: userController.obtenirUtilisateur.bind(userController),
  });

  app.delete("/:id", {
    handler: userController.supprimerUtilisateur.bind(userController),
  });

  app.get("/search/:email", {
    handler: userController..bind(userController),
  });
};
