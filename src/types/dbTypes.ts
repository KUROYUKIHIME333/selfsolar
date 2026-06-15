export type TypePlanSouscription = "FREE" | "STANDARD" | "PRO";

export interface DbProfiles {
  id: string | undefined;
  profile_picture: string | undefined;
  username: string | undefined;
  company_name: string | undefined;
  email: string;
  password: string;
  is_active: undefined | boolean;
  is_delete: boolean | undefined;
  created_at: Date | undefined;
  updated_at: Date | undefined;
}

export interface DbSubscriptionPlans {
  id: undefined | string;
  profile_icon: undefined | string;
  plan: TypePlanSouscription;
  price: number;
  currency: string;
  descript: undefined | string;
  is_delete: undefined | boolean;
  created_at: undefined | Date;
  updated_at: undefined | Date;
}

export interface DbSubscriptions {
  id: undefined | string;
  user_id: string;
  plan_subscriptions: string;
  is_active: undefined | boolean;
  is_delete: undefined | boolean;
  expires_at: undefined | Date;
  created_at: undefined | Date;
  updated_at: undefined | Date;
}
