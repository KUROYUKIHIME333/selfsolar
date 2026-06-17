import { FastifyRequest, FastifyReply } from "fastify";
import { profilesRequests } from "../db/requests/usersAndProfiles/requests.js";
import { DbProfiles } from "../types/dbTypes.js";
import { sendError, sendSuccess } from "../utils/handlers.utils.js";
import { db } from "../lib/db.js";

export class AdminController {
  public async createNewUser(reply: FastifyReply) {
    const response =
      await db`INSERT INTO profils (id, profile_picture, email, password) VALUES (gen_random_uuid(), null, 'Daaili@gmail', '7680f32c08d1a67d5a603c047280') RETURNING (id, email, profile_picture, username, company_name, created_at, updated_at);`;

    //TODO: Remove it when finishing working or debugging
    console.log("----------------------------------");
    console.log("CRESULT OF REQUEST IN THE CONTROLLER");
    console.log("----------------------------------");
    console.log("CREATION: ", response);
    console.log("----------------------------------");
    console.log("----------------------------------");

    return sendSuccess(reply, response, 200);
  }
}

export const adminController = new AdminController();
