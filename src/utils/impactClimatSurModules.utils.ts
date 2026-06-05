import {
  IRRADIANCE_NOCT,
  T_AMB_NOCT,
  A_REF,
  T_REF,
  T_REF_Noct,
} from "./constantesPhysiques.utils.js";
import type { TemperaturesMinMax } from "../types/installationPhotovoltaique.types.js";

/**
 * Calcule la température de cellule selon modèle NOCT (p.4-5 guide)
 * Formule: T_cell = T_amb + (NOCT - 20) × G / 800
 * Pour la temperature min, on suppose le matin, avec le froid de la nuit et sans rayonnement
 * Donc le panneau est presque à la temperature de l'air
 * Peut etre il y a aussi le vent mais on verra ensuite
 */
export const temperatureCelluleMinMax = (
  tAmbient: TemperaturesMinMax,
  irradianceMax: number, //G
  noct: number // Temperature noct de la cellule)
): {
  Tmin: number;
  Tmax: number;
} => {
  if (!tAmbient) {
    throw new Error("Le paramètre tAmbient est obligatoire.");
  }

  const { temperatureMin: tAmbientMin, temperatureMax: tAmbientMax } = tAmbient;

  if (typeof tAmbientMin !== "number" || typeof tAmbientMax !== "number") {
    throw new Error(
      "Les températures ambiantes min et max doivent être des nombres."
    );
  }
  if (tAmbientMin > tAmbientMax) {
    throw new Error(
      `Cohérence température : la température minimale (${tAmbientMin}°C) ne peut pas être supérieure à la maximale (${tAmbientMax}°C).`
    );
  }

  if (typeof irradianceMax !== "number" || isNaN(irradianceMax)) {
    throw new Error("L'irradiance maximale doit être un nombre valide.");
  }
  if (irradianceMax < 0) {
    throw new Error(
      `L'irradiance ne peut pas être négative (reçu: ${irradianceMax} W/m²).`
    );
  }
  if (irradianceMax > 1500) {
    // Alerte ou blocage si la valeur dépasse le rayonnement physique maximal sur Terre (~1360 W/m² hors atmosphère)
    throw new Error(
      `L'irradiance maximale semble irréaliste (reçu: ${irradianceMax} W/m²). Elle doit être inférieure à 1500 W/m².`
    );
  }

  if (typeof noct !== "number" || isNaN(noct)) {
    throw new Error("La valeur NOCT doit être un nombre valide.");
  }
  // Un NOCT normal de panneau silicium tourne généralement entre 40°C et 50°C
  if (noct < 30 || noct > 65) {
    throw new Error(
      `La valeur NOCT (${noct}°C) est en dehors des plages constructeurs réalistes (généralement entre 30°C et 65°C).`
    );
  }

  return {
    Tmin: tAmbientMin - 2,
    Tmax: tAmbientMax + ((noct - T_AMB_NOCT) * irradianceMax) / IRRADIANCE_NOCT,
  };
};

// WARNING:

/**
 * IDEA: En fonction du climat (chaud, froid, tempéré, ...) on a differentes priorités
 * En climat chaud, on va chercher à se rapprocher de N_panneaux_par_string_min pour éviter la sous-tension en plein soleil
 * donc Fclim -> 0
 * En climat froid, on va chercher à se rapprocher de N_panneaux_par_string_max pour maximiser la tension sans griller l'onduleur
 * donc Fclim -> 1
 *
 * Ce facteur nous permet de représenter le climat et de choisir N_panneaux_par_string EN FONCTION
 *
 * WARNING: C'est une petites lubie personnelle, et non un outils normalisé
 * WARNING: Mais c'est mon api, donc je fait ce que je veux
 */
export const nombreParClimat = (
  temperaturesAttendue: TemperaturesMinMax,
  Nmin: number,
  Nmax: number
): {
  success: boolean;
  nombrePanneaux: number;
  facteurClimatique: number;
  error?: string;
} => {
  if (
    typeof Nmin !== "number" ||
    typeof Nmax !== "number" ||
    isNaN(Nmin) ||
    isNaN(Nmax)
  ) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Nmin et Nmax doivent être des nombres valides.",
    };
  }
  if (Nmin < 0 || Nmax < 0) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Le nombre de panneaux ne peut pas être négatif.",
    };
  }
  if (Nmin > Nmax) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Nmin ne peut pas être supérieur à Nmax.",
    };
  }

  if (!temperaturesAttendue) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "L'objet des températures attendues est requis.",
    };
  }

  const { temperatureMin: Tmin, temperatureMax: Tmax } = temperaturesAttendue;

  if (
    typeof Tmin !== "number" ||
    typeof Tmax !== "number" ||
    isNaN(Tmin) ||
    isNaN(Tmax)
  ) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Les températures min et max doivent être des nombres valides.",
    };
  }
  if (Tmin >= Tmax) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error:
        "La température minimale doit être strictement inférieure à la température maximale (évite la division par zéro).",
    };
  }

  const amplitude_thermique = Tmax - Tmin; // A
  if (amplitude_thermique === T_REF_Noct) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: `Asymptote mathématique : l'amplitude thermique (${amplitude_thermique}°C) est exactement égale à T_REF_NOCT (${T_REF_Noct}°C), ce qui génère une division par zéro.`,
    };
  }

  const temperature_moyenne = (Tmax + Tmin) / 2; // Tmoy

  // variable climatique X
  const variable_climatique =
    (T_REF_Noct - temperature_moyenne) / (amplitude_thermique - T_REF_Noct);

  // sensibilité k
  const sensibilite_climatique =
    1 +
    amplitude_thermique / A_REF +
    (Math.abs(Tmax - T_REF_Noct) + Math.abs(Tmin - T_REF_Noct)) / (2 * T_REF);

  // Fclim strictement entre 0 et 1
  const facteur_climatique =
    1 / (1 + Math.exp(-sensibilite_climatique * variable_climatique));

  // Nombre de panneaux théorique continu
  const resultatTheorique = Nmin + facteur_climatique * (Nmax - Nmin);

  return {
    success: true,
    nombrePanneaux: Math.round(resultatTheorique), // Arrondit à l'entier le plus proche (vrai nombre de panneaux physiques)
    facteurClimatique: Number(facteur_climatique.toFixed(4)),
  };
};
