import { SUBSCRIPTIONS, SUBSCRIPTIONS_PLAN } from "../../dbTables.js";
import type {
  TypePlanSouscription,
  DbSubscriptionPlans,
  DbSubscriptions,
} from "../../../types/dbTypes.js";
import db from "../../../config/db.js";

export class SubscriptionsRequests {
  public async createSubscriptionPlan(newPlan: DbSubscriptionPlans) {

    const subscriptionPlan = await db`insert into ${SUBSCRIPTIONS_PLAN} ${db(
      newPlan
    )}`;
  }
}
