import { FastifyRequest, FastifyReply } from "fastify";
import { profilesRequests } from "../db/requests/usersAndProfiles/requests.js";
import { DbProfiles } from "../types/dbTypes.js";
import { sendError, sendSuccess } from "../utils/handlers.utils.js";

export class AdminController {
  public async createNewUser(
    request: FastifyRequest<{
      Body: {
        newUser: DbProfiles;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { newUser } = request.body;

      const { success, error, data } = await profilesRequests.createProfiles(
        newUser
      );

      //TODO: Remove it when finishing working or debugging
    console.log("CREATION: ", success);
    console.log("CREATION: ",error);
    console.log("CREATION: ", data);

      if (!success || error || !data) {
        return sendError(
          reply,
          error || "Une erreur est survenue lors de la création su profil",
          400
        );
      }

      //TODO: Remove it when finishing working or debugging
    console.log("CREATION: ", data);
      return sendSuccess(reply, data, 200);
    } catch (error) {}
  }
}

export const adminController = new AdminController();
