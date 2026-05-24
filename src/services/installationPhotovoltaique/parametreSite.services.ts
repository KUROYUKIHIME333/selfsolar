import type {
  Localisation,
  HemisphereValue,
  OrientationValue,
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
  localisation: Localisation
): Promise<{
  monthly: MRcalcMonthly[];
  angleOptimal: number | undefined;
}> => {
  const lat = localisation?.lat;
  const long = localisation?.long;

  const url =
    `${PVGIS_BASE}/MRcalc` +
    `?lat=${lat}&lon=${long}` +
    `&optimalinclination=1` + // inclinaison optimale annuelle
    `&outputformat=json` +
    `&browser=0`;

  // Correction : Cast simple et standard de la promesse pour éviter les bugs
  const json = (await fetchJson(url)) as MRcalcResponse;

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
 */
const fetchTMY = async (
  localisation: Localisation
): Promise<{
  T_min: number;
  T_max: number;
  windSpeed_mean: number;
  windSpeed_max: number;
}> => {
  const lat = localisation?.lat;
  const long = localisation?.long;

  const url =
    `${PVGIS_BASE}/tmy` +
    `?lat=${lat}&lon=${long}` +
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
    T_min: Number(T_min.toFixed(1)),
    T_max: Number(T_max.toFixed(1)),
    windSpeed_mean: count > 0 ? Number((wsSum / count).toFixed(2)) : 0,
    windSpeed_max: isFinite(wsMax) ? Number(wsMax.toFixed(1)) : 0,
  };
};

export class ParametresSiteService {
  /**
   * Détermine l'angle d'inclinaison optimal et l'orientation des panneaux
   * selon la latitude
   * 
   * Règles:
   * - Latitude < 15°: quasi-horizontal (0-10°)
   * - 15-25°: angle = latitude
   * - > 25°: angle = 0.76 × latitude + 3.1
   */
  angleOptimal(latitude: number): {
    hemisphère: HemisphereValue;
    orientation: "N" | "S" | "Quelconque";
    angle: number;
  } {
    const absLat = Math.abs(latitude);

    let angle: number = 10;
    let hemisphere: HemisphereValue = "S";
    let orientation: OrientationValue = "N";

    // Détermination hémisphère et orientation vers l'équateur (avec repli par défaut)
    if (latitude >= 0) {
      hemisphere = "N";
      orientation = "S"; // Face au Sud
    }

    if (latitude === 0) {
      hemisphere = "Equateur";
      orientation = "Quelconque"; // Orientation indifférente à l'équateur
    }

    // Calcul de l'angle selon les plages de ton guide
    if (absLat >= 15 && absLat <= 25) {
      angle = Math.round(absLat);
    } else if (absLat > 25) {
      angle = Math.round(absLat * 0.76 + 3.1);
    } else {
      angle = 10; // Règle par défaut pour les latitudes inférieures à 15°
    }

    return {
      hemisphère: hemisphere,
      orientation: orientation,
      angle: angle,
    };
  }

  /**
   * Récupère les données PVGIS pour le dimensionnement PV.
   */
  async PVGISDatas(
    localisation: Localisation,
    targetYear: number = DEFAULT_TARGET_YEAR
  ): Promise<PVGISDatasResult> {
    try {
      // Sécurité : Vérification immédiate de la présence de l'objet de localisation
      if (!localisation) {
        throw new Error("L'objet de localisation est manquant");
      }

      // Deux appels en parallèle
      const [mrcalcResult, tmyResult] = await Promise.all([
        fetchMRcalc(localisation),
        fetchTMY(localisation),
      ]);

      const { monthly, angleOptimal } = mrcalcResult;

      // PSH mensuelle depuis H(i_opt)_m
      const monthlyPSH = monthly.map((m) => {
        const nbJours = daysInMonth(m.month);
        // Sécurité anti-division par 0 au cas où daysInMonth renverrait une valeur invalide
        const diviseurJours = nbJours > 0 ? nbJours : 30;

        return {
          month: m.month,
          psh: m["H(i_opt)_m"] / 1000 / diviseurJours,
        };
      });

      // Mois défavorable (PSH min) et favorable (PSH max)
      const moisDefavorable = monthlyPSH.reduce((worst, curr) =>
        curr.psh < worst.psh ? curr : worst
      );
      const moisSurfavorable = monthlyPSH.reduce((best, curr) =>
        curr.psh > best.psh ? curr : best
      );

      // Correction climatique GIEC SSP2-4.5
      const fraction = climateFraction(targetYear);
      const dT = IPCC_DELTA.dT * fraction;
      const dG = IPCC_DELTA.dG * fraction;

      const PSH_min_corrected = Number(
        (moisDefavorable.psh * (1 + dG)).toFixed(3)
      );
      const PSH_max_corrected = Number(
        (moisSurfavorable.psh * (1 + dG)).toFixed(3)
      );
      const T_min_corrected = Number((tmyResult.T_min + dT).toFixed(1));
      const T_max_corrected = Number((tmyResult.T_max + dT).toFixed(1));

      return {
        PSH: PSH_min_corrected,
        PSH_max: PSH_max_corrected,
        G_moy: PSH_min_corrected,
        G_max: PSH_max_corrected,

        T_min: T_min_corrected,
        T_max: T_max_corrected,

        windSpeed_mean: tmyResult.windSpeed_mean,
        windSpeed_max: tmyResult.windSpeed_max,

        angleOptimalPVGIS: angleOptimal,
        moisDefavorable: String(moisDefavorable.month),
        moisSurfavorable: String(moisSurfavorable.month),
        isFallback: false,

        climateCorrection: {
          dT: Number(dT.toFixed(2)),
          dGPercent: Number((dG * 100).toFixed(2)),
          targetYear,
          fraction: Number(fraction.toFixed(3)),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        "[PVGISDatas] Échec PVGIS, bascule sur les valeurs de repli:",
        message
      );

      // Correction : Protection stricte contre un crash si localisation est undefined
      const safeLat = localisation?.lat ?? 0;
      const latAbs = Math.abs(safeLat);
      let pshFallback: number;

      if (latAbs < 10) pshFallback = 4.5;
      else if (latAbs < 20) pshFallback = 4.8;
      else if (latAbs < 35) pshFallback = 4.0;
      else if (latAbs < 50) pshFallback = 2.5;
      else pshFallback = 1.8;

      console.warn(
        `[PVGISDatas] Fallback appliqué : PSH=${pshFallback} kWh/m²/j pour lat=${safeLat}`
      );

      return {
        PSH: pshFallback,
        PSH_max: pshFallback,
        G_moy: pshFallback,
        G_max: pshFallback,
        T_min: 15,
        T_max: 40,
        windSpeed_mean: 1.5,
        windSpeed_max: 5,
        isFallback: true,
      };
    }
  }
}

export const parametresSiteService = new ParametresSiteService();
