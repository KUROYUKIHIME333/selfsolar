import { basicRequests } from "../../basicRequests.js";
import { PROFILES, PROFILES_FIELDS_TO_SEND } from "../../dbTables.js";
import type { DbProfiles } from "../../../types/dbTypes.js";

export class ProfilesRequests {
  public async findByEmail(email: string) {
    const result = await basicRequests.selectByFieldFromTable(PROFILES, {
      email: email,
    });

    return result;
  }

  public async findById(id: string) {
    const result = await basicRequests.selectByIdFromTable(PROFILES, id);

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
    const result = await basicRequests.softDeleteFromTable(PROFILES, id, [
      "id",
      "email",
      "is_deleted",
      "updated_at",
    ]);

    return result;
  }

  public async isUserActive(condition: { email: string } | { id: string }) {
    const result = await basicRequests.selectByFieldFromTable(
      PROFILES,
      condition
    );

    return result;
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
      { is_active: true },
      "active"
    );

    return result;
  }

  public async countNonactiveProfiles() {
    const result = await basicRequests.countByAFieldFromTable(
      PROFILES,
      { is_active: false },
      "active"
    );

    return result;
  }

  public async countSoftDeletedProfiles() {
    const result = await basicRequests.countAllFromTable(PROFILES, "deleted");

    return result;
  }

  public async countNoSoftDeletedProfiles() {
    const result = await basicRequests.countAllFromTable(PROFILES, "active");

    return result;
  }

  public async countAllProfiles() {
    const result = await basicRequests.countAllFromTable(PROFILES, "all");

    return result;
  }
}

export const profilesRequests = new ProfilesRequests();
