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
        {
          id: user[0].id,
          picture: user[0].profile_picture || null,
          username: user[0].username || null,
          company: user[0].company_name || null,
          email: user[0].email,
          isActive: user[0].is_active,
          creation: user[0].created_at,
        },
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
      const { newDatas } = request?.body;
      //const id = (request?.params as object) ?? null;
      const id = request?.params.id;

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
        return sendError(reply, "Problème critique: modificaton multiple", 400);
      }
      if (!updateUser || !updateUser[0]) {
        return sendError(reply, "Désolé, utilisateur non créé", 500);
      }
      return sendSuccess(
        reply,
        {
          id: updateUser[0].id,
          picture: updateUser[0].profile_picture || null,
          username: updateUser[0].username || null,
          company: updateUser[0].company_name || null,
          email: updateUser[0].email,
          isActive: updateUser[0].is_active,
          modification: updateUser[0].updated_at,
        },
        200
      );
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }

  public async supprimerUtilisateur(
    request: FastifyRequest<{
      Body: {
        id: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.body;

      if (!id || typeof id !== "string") {
        return sendError(reply, "ID manquant ou invalide", 400);
      }
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }

  public async obtenirUtilisateur(reply: FastifyReply) {}
}

export const userController = new UserController();
