import { FastifyRequest, FastifyReply } from "fastify";
import { DbProfiles } from "../types/dbTypes.js";
import { profilesRequests } from "../db/requests/usersAndProfiles/requests.js";
import { sendError, sendSuccess } from "../utils/handlers.utils.js";

export class UserController {
  public async creerNouveauProfile(
    request: FastifyRequest<{
      Body: { newUser: DbProfiles };
    }>,
    reply: FastifyReply
  ) {
    console.log(request.body);

    try {
      const { newUser } = request.body;

      if (!newUser || typeof newUser !== "object") {
        return sendError(
          reply,
          "Données utilisateur manquantes ou invalides",
          400
        );
      }

      if (!newUser?.password || typeof newUser.password !== "string") {
        return sendError(
          reply,
          "Mot de passe manquant ou invalide. IL DOIT ETRE HASHE SURTOUT",
          400
        );
      }

      if (!newUser?.email || typeof newUser.email !== "string") {
        return sendError(reply, "Email manquant ou invalide", 400);
      }

      const existingUser = await profilesRequests.findByEmail(newUser.email);

      if (existingUser.length > 0) {
        return sendError(
          reply,
          "Email fourni déjà utilisé pour un compte",
          400
        );
      }

      const user = await profilesRequests.createUser(newUser);

      if (user.length > 1) {
        console.error("PROBLEME CRITIQUE: INSERTION MULTIPLE DETECTEE");

        return sendError(
          reply,
          "PROBLEME CRITIQUE: INSERTION MULTIPLE DETECTEE",
          500
        );
      }

      if (!user || !user[0]) {
        return sendError(reply, "Désolé, utilisateur non créé", 500);
      }

      return sendSuccess(
        reply,
        user[0],
        200
      );
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }

  public async modifierUtilisateurExistant(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        newDatas: DbProfiles;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { newDatas } = request.body;
      const id = request.params.id;

      console.log("--------------------------");
      console.log(JSON.stringify(id));
      console.log("--------------------------");
      console.log(typeof request?.params);
      console.log("--------------------------");

      if (!id || typeof id !== "string") {
        return sendError(reply, "ID manquant ou invalide", 400);
      }

      if (!newDatas || typeof newDatas !== "object") {
        return sendError(
          reply,
          "Nouvelles données manquantes ou invalides",
          400
        );
      }

      const updateUser = await profilesRequests.updateUser(id, newDatas);

      if (updateUser.length > 1) {
        return sendError(reply, "Problème critique: modificaton multiple", 500);
      }
      if (!updateUser || !updateUser[0]) {
        return sendError(reply, "Désolé, utilisateur non créé", 500);
      }
      return sendSuccess(
        reply,
        updateUser[0],
        200
      );
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }

  public async supprimerUtilisateur(
    request: FastifyRequest<{
      Params: {
        id: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const id = request.params.id;

      if (!id || typeof id !== "string") {
        return sendError(reply, "ID manquant ou invalide", 400);
      }

      const deleteUser = await profilesRequests.deleteUser(id);

      if (deleteUser.length > 1) {
        return sendError(reply, "Problème critique: modificaton multiple", 500);
      }
      if (!deleteUser || !deleteUser[0]) {
        return sendError(reply, "Désolé, utilisateur non créé", 500);
      }

      return sendSuccess(reply, deleteUser[0], 200);
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }

  public async obtenirUtilisateur(
    request: FastifyRequest<{
      Params: {
        id: string;
        email: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {id, email} = request.params;
      let searchedUser: any[] = [];


      if (!id || typeof id !== "string") {
        return sendError(reply, "ID manquant ou invalide", 400);
      }

      if (!id && email) {
        searchedUser = await profilesRequests.findByEmail(email);
      }
      if (id && !email) {
        searchedUser = await profilesRequests.findById(id);
      }
      if (searchedUser.length === 0) {
        return sendError(reply, "Aucun utilisateur trouvé", 404);
      }
      if (searchedUser.length > 1) {
        return sendError(reply, "Problème critique: selection multiple", 500);
      }
      if (!searchedUser || !searchedUser[0]) {
        return sendError(reply, "Désolé, utilisateur non créé", 500);
      }

      return sendSuccess(reply, searchedUser[0], 200)
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }
}

export const userController = new UserController();
