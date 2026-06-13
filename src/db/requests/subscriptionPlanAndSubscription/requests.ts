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
    if (!newPlan || !newPlan.plan || !newPlan.currency || !newPlan.plan) {
      return sendResponse(
        false,
        "le nom du plan, son prix et sa devise sont à renseigner",
        null
      );
    };
    const columns = getKeysCommaSeparated(newPlan);
    const values = getValuesCommaSeparated(newPlan);

    const subscriptionPlan =
      await db`INSERT INTO ${SUBSCRIPTIONS_PLAN}(${columns}) VALUES(${values}) ON CONFLICT(plan) DO NOTHING RETURNING *`;

    if (!subscriptionPlan) {
      return sendResponse(false, "Ce plan de souscription existe déjà", null);
    }

    return sendResponse(true, null, subscriptionPlan);
  }

  //   public async createSuscription() {}
}

export const subscriptionsRequests = new SubscriptionsRequests();
