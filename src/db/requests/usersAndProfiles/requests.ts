import { basicRequests } from "../../basicRequests.js";
import { PROFILES, PROFILES_FIELDS_TO_SEND } from "../../dbTables.js";
export class ProfilesRequests {
  public async findByEmail(email: string) {
    const result = await basicRequests.selectByFieldFromTable(
      PROFILES,
      "email",
      email
    );
    return result;
  }

  public async countActiveProfiles() {
    const result = await basicRequests.countByAFieldFromTable(
      PROFILES,
      "isActive",
      true
    );
    return result;
  }

  public async countNonactiveProfiles() {
    const result = await basicRequests.countByAFieldFromTable(
      PROFILES,
      "isActive",
      false
    );
    return result;
  }
}

export const profilesRequests = new ProfilesRequests();
