import { db } from "../../../config/db.js";
import { PROFILES, PROFILES_FIELDS_TO_SEND } from "../../dbTables.js";
import type { DbProfiles } from "../../../types/dbTypes.js";
import { basicRequests } from "../../basicRequests.js";
import { getKeysArray } from "../../../utils/toolbox.utils.js";
export class ProfilesRequests {
  public async createProfiles(newUser: DbProfiles) {
    const sqlRequest = basicRequests.insertIntoTable(
      PROFILES,
      newUser,
      PROFILES_FIELDS_TO_SEND
    );
    const columns = getKeysArray(newUser);

    console.log(sqlRequest);

    const response = await db`insert into profiles ${db(newUser, columns)}`;

    return response;
  }
}

export const profilesRequests = new ProfilesRequests();
