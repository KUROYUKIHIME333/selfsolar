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

      if (newUser?.password && newUser?.email) {
        const existingUser = await profilesRequests.findByEmail(newUser.email);

        if (existingUser.length > 0) {
          return sendError(
            reply,
            "Email fourni déjà utilisé pour un compte",
            400
          );
        }

        const user = await profilesRequests.createUser(newUser);

        //TODO: debugging to remove
        console.log(user);

        if (user.length > 0) {
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
      }

      return sendError(
        reply,
        "L'email et le mot de passe (hashé) doivent être renseignés",
        400
      );
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }

  public async modifierUtilisateurExistant(
    request: FastifyRequest<{
      Body: {
        id: string;
        newDatas: DbProfiles;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { id, newDatas } = request.body;

      if (newDatas) {
        const updateUser = await profilesRequests.updateUser(id, newDatas);

        if (updateUser.length > 0) {
          return sendError(
            reply,
            "Problème critique: modificaton multiple",
            400
          );
        }
        if (!updateUser || !updateUser[0]) {
          return sendError(reply, "Désolé, utilisateur non créé", 500);
        }
      }
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }
}

export const userController = new UserController();
