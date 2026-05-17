import type {
  Localisation,
  MRcalcMonthly,
  MRcalcResponse,
  TMYResponse,
  PVGISDatasResult,
} from "../../types/installationPhotovoltaique.types.js";

import {
  PVGIS_BASE,
  fetchJson,
  DEFAULT_TARGET_YEAR,
  daysInMonth,
  climateFraction,
  IPCC_DELTA,
} from "../../utils/meteoDatasAndConstantes.utils.js";

// Utilise PVGIS (Photovoltaic Geographical Information System) de la Commission Européenne
// et calculs d'angle optimal selon latitude (p.4 du guide)

// Appel 1 : MRcalc (radiation mensuelle)
/**
 * Récupère les données mensuelles de radiation via MRcalc.
 * Utilise l'inclinaison optimale annuelle (optimalinclination=1).
 * H(i_opt)_m est en Wh/m²/mois → converti en PSH (kWh/m²/j).
 */
const fetchMRcalc = async (
  lat: number,
  lon: number
): Promise<{
  monthly: MRcalcMonthly[];
  angleOptimal: number | undefined;
}> => {
  const url =
    `${PVGIS_BASE}/MRcalc` +
    `?lat=${lat}&lon=${lon}` +
    `&optimalinclination=1` + // inclinaison optimale annuelle
    `&outputformat=json` +
    `&browser=0`;

  const data = fetchJson(url) as Promise<MRcalcResponse>;
  const json = await data;

  const monthly = json.outputs?.monthly;
  if (!Array.isArray(monthly) || monthly.length === 0) {
    throw new Error("MRcalc : outputs.monthly absent ou vide");
  }

  const angleOptimal = json.inputs?.plane?.["fixed(i_opt)"]?.slope?.value;

  return { monthly, angleOptimal };
};

// Appel 2 : TMY (température et vent horaires)
/**
 * Récupère le TMY et extrait Tmin, Tmax, WS_mean, WS_max.
 * Le TMY est une année "typique" synthétique — Tmin/Tmax sont représentatifs
 * du climat moyen, pas des extrêmes absolus historiques.
 * Pour les extrêmes absolus, il faudrait seriescalc sur toutes les années,
 * ce qui représente ~150 000 lignes de données (coût réseau significatif).
 */
const fetchTMY = async (
  lat: number,
  lon: number
): Promise<{
  T_min: number;
  T_max: number;
  windSpeed_mean: number;
  windSpeed_max: number;
}> => {
  const url =
    `${PVGIS_BASE}/tmy` +
    `?lat=${lat}&lon=${lon}` +
    `&outputformat=json` +
    `&browser=0`;

  const json = (await fetchJson(url)) as TMYResponse;

  const hourly = json.outputs?.tmy_hourly;
  if (!Array.isArray(hourly) || hourly.length === 0) {
    throw new Error("TMY : outputs.tmy_hourly absent ou vide");
  }

  let T_min = Infinity;
  let T_max = -Infinity;
  let wsSum = 0;
  let wsMax = -Infinity;
  let count = 0;

  for (const h of hourly) {
    const T = h.T2m;
    const ws = h.WS10m;

    if (typeof T === "number" && isFinite(T)) {
      if (T < T_min) T_min = T;
      if (T > T_max) T_max = T;
    }

    if (typeof ws === "number" && isFinite(ws)) {
      wsSum += ws;
      if (ws > wsMax) wsMax = ws;
      count++;
    }
  }

  if (!isFinite(T_min) || !isFinite(T_max)) {
    throw new Error("TMY : aucune valeur T2m valide trouvée");
  }

  return {
    T_min: +T_min.toFixed(1),
    T_max: +T_max.toFixed(1),
    windSpeed_mean: count > 0 ? +(wsSum / count).toFixed(2) : 0,
    windSpeed_max: isFinite(wsMax) ? +wsMax.toFixed(1) : 0,
  };
};

export class ParametresSiteService {
  /**
   * Détermine l'angle d'inclinaison optimal et l'orientation des panneaux
   * selon la latitude (méthode simplifiée p.4 du guide)
   *
   * Règles:
   * - Latitude < 15°: quasi-horizontal (0-10°)
   * - 15-25°: angle = latitude
   * - > 25°: angle = 0.76 × latitude + 3.1
   *
   * @param latitude Latitude en degrés (-90 à 90)
   * @returns Paramètres d'orientation optimaux
   */
  angleOptimal(latitude: number): {
    hemisphère: string;
    orientation: string;
    angle: number;
  } {
    const absLat = Math.abs(latitude);

    let angle: number = 10;
    let hemisphere: string = "";
    let orientation: string = "";

    // Détermination hémisphère et orientation (vers équateur)
    if (latitude > 0) {
      hemisphere = "N";
      orientation = "S"; // Sud pour hémisphère nord
    }
    if (latitude < 0) {
      hemisphere = "S";
      orientation = "N"; // Nord pour hémisphère sud
    }

    // Calcul angle optimal selon latitude (p.4 guide fait avant)
    if (absLat >= 15 && absLat <= 25) {
      // Zones tropicales/subtropicales: angle = latitude
      angle = Math.round(absLat);
    }
    if (absLat > 25) {
      // Zones tempérées/froides: angle optimisé hiver
      angle = Math.round(absLat * 0.76 + 3.1);
    }

    return {
      hemisphère: hemisphere,
      orientation: orientation,
      angle: angle,
    };
  }

  /**
   * Récupère les données PVGIS 5.3 pour le dimensionnement PV.
   *
   * @param localisation  - Coordonnées { lat, long }
   * @param targetYear    - Horizon climatique pour correction GIEC (défaut: 2040)
   *
   * @returns PVGISDatasResult avec PSH min/max, T min/max, vent, correction GIEC
   */
  async PVGISDatas(
    localisation: Localisation,
    targetYear: number = DEFAULT_TARGET_YEAR
  ): Promise<PVGISDatasResult> {
    const { lat, long: lon } = localisation;

    try {
      // Deux appels en parallèle
      const [mrcalcResult, tmyResult] = await Promise.all([
        fetchMRcalc(lat, lon),
        fetchTMY(lat, lon),
      ]);

      const { monthly, angleOptimal } = mrcalcResult;

      // PSH mensuelle depuis H(i_opt)_m
      // H(i_opt)_m est en Wh/m²/mois (moyenne annuelle sur toutes les années)
      // PSH (kWh/m²/j) = H(i_opt)_m / 1000 / nb_jours_mois
      const monthlyPSH = monthly.map((m) => ({
        month: m.month,
        psh: m["H(i_opt)_m"] / 1000 / daysInMonth(m.month),
      }));

      // Mois défavorable (PSH min) et favorable (PSH max)
      const moisDefavorable = monthlyPSH.reduce((worst, curr) =>
        curr.psh < worst.psh ? curr : worst
      );
      const moisSurfavorable = monthlyPSH.reduce((best, curr) =>
        curr.psh > best.psh ? curr : best
      );

      // Correction climatique GIEC SSP2-4.5
      // LIMITE : modèle linéaire global, non régionalisé.
      // Pour Kinshasa : AR6 Table SPM.1 indique +1.4–2.1°C à 2050 (SSP2-4.5).
      // On utilise la valeur centrale mondiale de 1.5°C.
      const fraction = climateFraction(targetYear);
      const dT = IPCC_DELTA.dT * fraction;
      const dG = IPCC_DELTA.dG * fraction;

      const PSH_min_corrected = +(moisDefavorable.psh * (1 + dG)).toFixed(3);
      const PSH_max_corrected = +(moisSurfavorable.psh * (1 + dG)).toFixed(3);
      const T_min_corrected = +(tmyResult.T_min + dT).toFixed(1);
      const T_max_corrected = +(tmyResult.T_max + dT).toFixed(1);

      return {
        // Irradiation / PSH
        PSH: PSH_min_corrected,
        PSH_max: PSH_max_corrected,
        G_moy: PSH_min_corrected, // alias compatibilité
        G_max: PSH_max_corrected, // alias compatibilité

        // Températures
        T_min: T_min_corrected,
        T_max: T_max_corrected,

        // Vent (TMY brut, pas de correction climatique sur le vent — incertitude trop élevée)
        windSpeed_mean: tmyResult.windSpeed_mean,
        windSpeed_max: tmyResult.windSpeed_max,

        // Métadonnées
        angleOptimalPVGIS: angleOptimal,
        moisDefavorable: String(moisDefavorable.month),
        moisSurfavorable: String(moisSurfavorable.month),
        isFallback: false,

        climateCorrection: {
          dT: +dT.toFixed(2),
          dGPercent: +(dG * 100).toFixed(2),
          targetYear,
          fraction: +fraction.toFixed(3),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[PVGISDatas] Échec PVGIS:", message);

      // Fallback conservateur basé sur la latitude
      // Valeurs issues de la littérature (Agence Internationale de l'Énergie,
      // Atlas Solaire de l'Afrique). Intentionnellement pessimistes.
      const latAbs = Math.abs(lat);
      let pshFallback: number;

      if (latAbs < 10) pshFallback = 4.5;
      // équatorial (ex: Kinshasa)
      else if (latAbs < 20) pshFallback = 4.8;
      // tropical
      else if (latAbs < 35) pshFallback = 4.0;
      // subtropical
      else if (latAbs < 50) pshFallback = 2.5;
      // tempéré
      else pshFallback = 1.8; // boréal/austral

      console.warn(
        `[PVGISDatas] Fallback : PSH=${pshFallback} kWh/m²/j, lat=${lat}`
      );

      return {
        PSH: pshFallback,
        PSH_max: pshFallback,
        G_moy: pshFallback,
        G_max: pshFallback,
        T_min: 15, // conservateur, à surcharger manuellement si possible
        T_max: 40, // conservateur
        windSpeed_mean: 1.5,
        windSpeed_max: 5,
        isFallback: true,
      };
    }
  }
}

export const parametresSiteService = new ParametresSiteService();
