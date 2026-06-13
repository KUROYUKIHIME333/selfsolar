export type TypePlanSouscription = "FREE" | "STANDARD" | "PRO";

export interface DbProfiles {
  email: string;
  password: string;
  id?: string;
  profile_picture?: string;
  username?: string;
  company_name?: string;
  is_delete?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface DbSubscriptionPlans {
  plan: TypePlanSouscription;
  price: number;
  currency: string;
  descript?: string;
  is_delete?: boolean;
  id?: string;
  profile_icon?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface DbSubscriptions {
  user_id: string;
  plan_subscriptions: string;
  is_active?: boolean;
  id?: string;
  is_delete?: boolean;
  expires_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}
