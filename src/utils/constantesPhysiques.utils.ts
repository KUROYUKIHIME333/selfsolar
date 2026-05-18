import { execPath } from "node:process";
import type { MethodePose } from "../types/installationPhotovoltaique.types.js";

export const RESISTIVITE = {
  cuivre: 0.01786,
  aluminium: 0.02826,
} as const;

export const COEFF_TEMP = {
  cuivre: 0.00393,
  aluminium: 0.00403,
} as const;

export const TEMP_MAX_CONDUCTEUR = {
  "PV1-F": 90,
  "H1Z2Z2-K": 90,
  PVC: 70,
  XLPE: 90,
} as const;

export const SECTIONS_NORMALISEES = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
] as const;

export const COURANT_ADMISSIBLE_CUIVRE_B2: Record<number, number> = {
  1.5: 17.5,
  2.5: 24,
  4: 32,
  6: 41,
  10: 57,
  16: 76,
  25: 101,
  35: 125,
  50: 151,
  70: 192,
  95: 232,
  120: 269,
  150: 300,
  185: 341,
  240: 400,
  300: 458,
} as const;

export const FACTEUR_ALUMINIUM = 0.78;

export const FACTEUR_TEMPERATURE_PVC: Record<number, number> = {
  30: 1.0,
  35: 0.94,
  40: 0.87,
  45: 0.79,
  50: 0.71,
  55: 0.61,
  60: 0.5,
} as const;

export const FACTEUR_POSE: Record<MethodePose, number> = {
  conduit_encastre: 0.7,
  conduit_surface: 0.8,
  air_libre: 1.0,
  enterre: 0.6,
  gaine_technique: 0.75,
} as const;

export const FACTEUR_GROUPEMENT: Record<number, number> = {
  1: 1.0,
  2: 0.8,
  3: 0.7,
  4: 0.65,
  5: 0.6,
  6: 0.57,
} as const;

export const CALIBRES_FUSIBLES_DC = [
  2, 4, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250,
] as const;

export const CALIBRES_DISJONCTEURS = [
  10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500,
  630,
] as const;

export const PALIERS_PC_BAS_TENSION8SYSTEME_PV = 500;

// Constantes physiques et normatives
export const IRRADIANCE_NOCT = 800; // W/m² - Condition NOCT (p.5 guide)
export const T_AMB_NOCT = 20; // °C - Température ambiante référence NOCT
export const IRRADIANCE_STC = 1000; // W/m² - Standard Test Conditions
export const FACTEUR_SECURITE_COURANT = 1.25; // Facteur IEC 62109 pour tolérance + vieillissement
export const T_STC = 25;

export const A_REF = 20;
export const T_REF = 20;
export const T_REF_Noct = 20;
