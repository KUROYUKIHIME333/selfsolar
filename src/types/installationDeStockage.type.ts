export type CasUsage =
  | "ONDULEUR_SECOURS_COURT_TERME"
  | "BACKUP_LONGUE_DUREE(NUITS/COUPURES)"
  | "EFFACEMENT_TARIFAIRE"
  | "SITE_ISOLE(RESEAU+BATT)"
  | "REGULATION_PUISSANCE_RESEAU";

export type CasUsageResultat = {
  dechargeMin: number; // Durée de décharge minimale en heure
  dechargeMax: number; // Durée de décharge maximale en heure
  puissanceReq: number; // 
};
