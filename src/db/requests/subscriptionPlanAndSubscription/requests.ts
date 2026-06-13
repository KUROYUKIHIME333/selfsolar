import { SUBSCRIPTIONS_PLAN } from "../../dbTables.js";
import type {
  //   TypePlanSouscription,
  DbSubscriptionPlans,
  //   DbSubscriptions,
} from "../../../types/dbTypes.js";
import db from "../../../config/db.js";
import {
  getKeysCommaSeparated,
  getValuesCommaSeparated,
} from "../../../utils/toolbox.utils.js";
import { sendResponse } from "../../../utils/handlers.utils.js";

export class SubscriptionsRequests {
  public async createSubscriptionPlan(newPlan: DbSubscriptionPlans) {
    const columns = getKeysCommaSeparated(newPlan);
    const values = getValuesCommaSeparated(newPlan);

    const subscriptionPlan =
      await db`INSERT INTO ${SUBSCRIPTIONS_PLAN}(${columns}) VALUES(${values}) ON CONFLICT(id, plan) DO NOTHING RETURNING *`;

    if (!subscriptionPlan) {
      return sendResponse(
        false,
        "Le plan de souscription n'a pas été créé",
        null
      );
    }

    return sendResponse(true, null, subscriptionPlan);
  }

  //   public async createSuscription() {}
}

export const subscriptionsRequests = new SubscriptionsRequests();
