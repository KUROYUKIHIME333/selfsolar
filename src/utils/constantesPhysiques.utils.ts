import type {
  MethodePose,
  MateriauConducteur,
  TechnologieBatterie,
} from "../types/installationPhotovoltaique.types.js";

interface CommunesTechnologie {
  readonly profondeurDecharge: number;
  readonly cyclesMin: number;
  readonly cyclesMax: number;
  readonly tempMin: number;
  readonly tempMax: number;
  readonly facteurMajorationCharge: number;
}

// CARACTÉRISTIQUES PHYSIQUES DES MATÉRIAUX CONDUCTEURS

export const RESISTIVITE: Record<MateriauConducteur, number> = {
  cuivre: 0.01786, // Ω.mm²/m à 20°C
  aluminium: 0.02826, // Ω.mm²/m à 20°C
} as const;

export const COEFF_TEMP: Record<MateriauConducteur, number> = {
  cuivre: 0.00393, // Perte de conductivité par °C (Cuivre)
  aluminium: 0.00403, // Perte de conductivité par °C (Aluminium)
} as const;

export const TEMP_MAX_CONDUCTEUR = {
  "PV1-F": 90,
  "H1Z2Z2-K": 90,
  PVC: 70,
  XLPE: 90,
} as const;

// SECTIONS ET COURANTS ADMISSIBLES (NF C 15-100 / UTE C 15-712)

export const SECTIONS_NORMALISEES = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500,
  630, 800, 1000, 1200, 1500, 2000, 2500, 3000,
] as const;

// Courants admissibles de référence (Méthode B2, conducteurs isolés dans des conduits)
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
  300: 430,
  400: 510,
  500: 590,
  630: 695,
  800: 790,
  1000: 910,
  1200: 1020,
  1500: 1180,
  2000: 1390,
  2500: 1610,
  3000: 1840,
};

export const COURANT_ADMISSIBLE_ALU_B2: Record<number, number> = {
  1.5: 13.5,
  2.5: 18.5,
  4: 25,
  6: 32,
  10: 44,
  16: 59,
  25: 79,
  35: 97,
  50: 117,
  70: 150,
  95: 181,
  120: 210,
  150: 234,
  185: 266,
  240: 312,
  300: 335,
  400: 398,
  500: 460,
  630: 542,
  800: 616,
  1000: 710,
  1200: 795,
  1500: 920,
  2000: 1085,
  2500: 1255,
  3000: 1435,
};

export const FACTEUR_ALUMINIUM = 0.78;

// FACTEURS DE CORRECTION ET D'ENVIRONNEMENT

export const FACTEUR_TEMPERATURE_PVC: Record<number, number> = {
  10: 1.22,
  15: 1.17,
  20: 1.12,
  25: 1.06,
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
  7: 0.54,
  8: 0.52,
  9: 0.5,
} as const;

// APPAREILLAGES ET CALIBRES DE PROTECTION

export const CALIBRES_FUSIBLES_DC = [
  2, 4, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250,
] as const;

export const CALIBRES_DISJONCTEURS = [
  10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500,
  630,
] as const;

// CONSTANTES PHYSIQUES ET NORMATIVES (GUIDE & CONDITIONS STANDARDS)

export const PALIERS_PC_BAS_TENSION_SYSTEME_PV = 500;
export const IRRADIANCE_NOCT = 800; // W/m² - Condition NOCT (p.5 guide)
export const T_AMB_NOCT = 20; // °C - Température ambiante référence NOCT
export const IRRADIANCE_STC = 1000; // W/m² - Standard Test Conditions
export const FACTEUR_SECURITE_COURANT = 1.25; // Facteur IEC 62109 pour tolérance + vieillissement
export const T_STC = 25; // °C - Température des cellules en STC

export const A_REF = 20;
export const T_REF = 20;
export const T_REF_Noct = 20;

// Dictionnaire de configuration des technologies figé et validé via satisfies
export const CONFIG_TECHNOLOGIES: Record<
  TechnologieBatterie,
  CommunesTechnologie
> = {
  "Plomb-acide": {
    profondeurDecharge: 0.5,
    cyclesMin: 300,
    cyclesMax: 700,
    tempMin: -15,
    tempMax: 40,
    facteurMajorationCharge: 1.35,
  },
  "AGM/Gel": {
    profondeurDecharge: 0.5,
    cyclesMin: 300,
    cyclesMax: 700,
    tempMin: -15,
    tempMax: 40,
    facteurMajorationCharge: 1.23,
  },
  LiFePO4: {
    profondeurDecharge: 0.8,
    cyclesMin: 3000,
    cyclesMax: 6000,
    tempMin: 0,
    tempMax: 55,
    facteurMajorationCharge: 1.1,
  },
  "Lithium NMC/NCA": {
    profondeurDecharge: 0.8,
    cyclesMin: 500,
    cyclesMax: 2000,
    tempMin: 0,
    tempMax: 45,
    facteurMajorationCharge: 1.15,
  },
  NiCd: {
    profondeurDecharge: 0.8,
    cyclesMin: 1500,
    cyclesMax: 3500,
    tempMin: -20,
    tempMax: 50,
    facteurMajorationCharge: 1.2,
  },
};
