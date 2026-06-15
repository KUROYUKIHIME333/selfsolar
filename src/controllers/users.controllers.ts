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

        if (existingUser) {
          return sendError(
            reply,
            "Email fourni déjà utilisé pour un compte",
            400
          );
        }

        const user = await profilesRequests.createUser(newUser);

        if (user) {
          return sendSuccess(
            reply,
            {
              id: user.id,
              picture: user.profile_picture || null,
              username: user.username || null,
              company: user.company_name || null,
              email: user.email,
              isActive: user.is_active,
              creation: user.created_at,
            },
            200
          );
        }

        return sendError(reply, "Désolé, utilisateur non créé", 500);
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
}

export const userController = new UserController();
