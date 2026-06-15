import { FastifyRequest, FastifyReply } from "fastify";
import { DbProfiles } from "../types/dbTypes.js";
import { profilesRequests } from "../db/requests/usersAndProfiles/requests.js";
import { sendError, sendSuccess } from "../utils/handlers.utils.js";

export class UserController {
  public async creerNouveauProfile(
    request: FastifyRequest<{
      Body: DbProfiles;
    }>,
    reply: FastifyReply
  ) {
    console.log(request.body);

    try {
      const newUser = request.body;

      console.log(newUser || "rien à montrer");

      if (!newUser || !newUser.email || !newUser.password) {
        return sendError(
          reply,
          "Email et mot de passe doivent être renseignés",
          400
        );
      }

      const result = await profilesRequests.createProfiles(newUser);

      return sendSuccess(reply, result, 200);
    } catch (error: unknown) {
      return sendError(reply, error, 500);
    }
  }
}

export const userController = new UserController();
