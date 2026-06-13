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
    const columns = getKeysCommaSeparated(newUser);
    const values = getValuesCommaSeparated(newUser);

    const profile =
      await db`INSERT INTO ${PROFILES}(${columns}) VALUES(${values}) ON CONFLICT(email) DO NOTHING RETURNING *`;

    if (!profile) {
      return sendResponse(false, "L'email fourni est dejà utilisé", null);
    }

    return sendResponse(true, null, profile);
  }
}

export const profilesRequests = new ProfilesRequests();
