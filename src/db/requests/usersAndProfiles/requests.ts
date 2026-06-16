import { basicRequests } from "../../basicRequests.js";
import { PROFILES, PROFILES_FIELDS_TO_SEND } from "../../dbTables.js";
import type { DbProfiles } from "../../../types/dbTypes.js";

export class ProfilesRequests {
  public async findByEmail(email: string) {
    const result = await basicRequests.selectByFieldFromTable(
      PROFILES,
      "email",
      email
    );

    return result;
  }

  public async createUser(data: Partial<DbProfiles>) {
    const result = await basicRequests.insertValuesIntoTable(
      PROFILES,
      data,
      PROFILES_FIELDS_TO_SEND
    );

    return result;
  }

  public async updateUser(id: string, data: Partial<DbProfiles>) {
    const result = await basicRequests.updateInTable(
      PROFILES,
      id,
      data,
      PROFILES_FIELDS_TO_SEND
    );

    return result;
  }

  public async deleteUser(id: string) {
    const result = await basicRequests.softDeleteFromTable(
      PROFILES,
      id,
      PROFILES_FIELDS_TO_SEND
    );

    return result;
  }

  public async isUserActive(
    searchValue: string,
    searchField: "email" | "id" = "id"
  ) {
    const result = await basicRequests.selectByFieldFromTable(
      PROFILES,
      searchField,
      searchValue
    );

    return result?.is_active;
  }

  public async desactivateUser(id: string) {
    const result = await basicRequests.updateInTable(
      PROFILES,
      id,
      { is_active: false },
      PROFILES_FIELDS_TO_SEND
    );

    return result;
  }

  public async activateUser(id: string) {
    const result = await basicRequests.updateInTable(
      PROFILES,
      id,
      { is_active: true },
      PROFILES_FIELDS_TO_SEND
    );

    return result;
  }

  public async countActiveProfiles() {
    const result = await basicRequests.countByAFieldFromTable(
      PROFILES,
      "is_active",
      true
    );

    return result;
  }

  public async countNonactiveProfiles() {
    const result = await basicRequests.countByAFieldFromTable(
      PROFILES,
      "is_active",
      false
    );

    return result;
  }
}

export const profilesRequests = new ProfilesRequests();
