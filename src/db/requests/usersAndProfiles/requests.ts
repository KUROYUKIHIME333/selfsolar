import { PROFILES } from "../../dbTables.js";
import type { DbProfiles } from "../../../types/dbTypes.js";
import db from "../../../config/db.js";
import {
  getKeysCommaSeparated,
  getValuesCommaSeparated,
} from "../../../utils/toolbox.utils.js";
import { sendResponse } from "../../../utils/handlers.utils.js";

export class ProfilesRequests {
  public async createProfiles(newUser: DbProfiles) {
    if (!newUser || !newUser.email || !newUser.password) {
      return sendResponse(
        false,
        "Renseigner l'email et le mot de passe pour inscription",
        null
      );
    }

    const columns = getKeysCommaSeparated(newUser);
    const values = getValuesCommaSeparated(newUser);

    const profile =
      await db`INSERT INTO ${PROFILES}(${columns}) VALUES(${values}) ON CONFLICT(email) DO NOTHING`;

    //TODO: Remove it when finishing working or debugging
    console.log("CREATION D'UN PROFILE :", profile);

    if (!profile) {
      return sendResponse(false, "L'email fourni est dejà utilisé", null);
    }

    return sendResponse(true, null, profile);
  }

  // public async updateProfiles(newUser: DbProfiles) {
  //   if (!newUser || !newUser.email || !newUser.password) {
  //     return sendResponse(
  //       false,
  //       "Renseigner l'email et le mot de passe pour inscription",
  //       null
  //     );
  //   }
  //   const columns = getKeysCommaSeparated(newUser);
  //   const values = getValuesCommaSeparated(newUser);

  //   // const profile =
  //   //   await db`INSERT INTO ${PROFILES}(${columns}) VALUES(${values}) ON CONFLICT(email) DO NOTHING RETURNING *`;

  //   // if (!profile) {
  //   //   return sendResponse(false, "L'email fourni est dejà utilisé", null);
  //   // }

  //   // return sendResponse(true, null, profile);
  // }

  // public async softDeleteProfiles(id: string) {
  //   if (!id) {
  //     return sendResponse(false, "Renseigner l'id du compte à supprimer", null);
  //   }

  //   // const profile =
  //   //   await db`INSERT INTO ${PROFILES}(${columns}) VALUES(${values}) ON CONFLICT(email) DO NOTHING RETURNING *`;

  //   // if (!profile) {
  //   //   return sendResponse(false, "L'email fourni est dejà utilisé", null);
  //   // }

  //   // return sendResponse(true, null, profile);
  // }
}

export const profilesRequests = new ProfilesRequests();
