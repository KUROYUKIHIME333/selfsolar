import { PROFILES } from "../db/dbTables.js";

export type TypePlanSouscription = "FREE" | "STANDARD" | "PRO";

export interface DbProfiles {
  email: string;
  password?: string;
  id?: string | undefined;
  profile_picture?: string | undefined;
  username?: string | undefined;
  company_name?: string | undefined;
  is_delete?: boolean | undefined;
  created_at?: Date | undefined;
  updated_at?: Date | undefined;
}

export interface DbSubscriptionPlans {
  plan: TypePlanSouscription;
  price: number;
  currency: string;
  descript?: undefined | string;
  is_delete?: undefined | boolean;
  id?: undefined | string;
  profile_icon?: undefined | string;
  created_at?: undefined | Date;
  updated_at?: undefined | Date;
}

export interface DbSubscriptions {
  user_id: string;
  plan_subscriptions: string;
  is_active?: undefined | boolean;
  id?: undefined | string;
  is_delete?: undefined | boolean;
  expires_at?: undefined | Date;
  created_at?: undefined | Date;
  updated_at?: undefined | Date;
}
