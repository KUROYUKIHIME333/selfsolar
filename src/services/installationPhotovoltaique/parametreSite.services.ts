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
  getIrradianceMaxOffline,
} from "../../utils/meteoDatasAndConstantes.utils.js";

// Utilise PVGIS (Photovoltaic Geographical Information System) de la Commission Européenne
// et calculs d'angle optimal selon latitude (p.4 du guide)

// Appel 1 : MRcalc (radiation mensuelle)
/**
 * Récupère les données mensuelles de radiation via MRcalc.
 * Utilise l'inclinaison optimale annuelle (optrad=1).
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
    `&optrad=1` +
    `&outputformat=json` +
    `&browser=0`;

  // Cast simple et standard de la promesse pour éviter les bugs
  const json = (await fetchJson(url)) as MRcalcResponse;

  console.log(
    "Structure complète de l'API PVGIS :",
    JSON.stringify(json.inputs)
  );

  const monthly = json.outputs?.monthly;
  if (!Array.isArray(monthly) || monthly.length === 0) {
    throw new Error("MRcalc : outputs.monthly absent ou vide");
  }

  const angleOptimal = json.inputs?.plane?.fixed_inclined_optimal?.slope?.value;

  return { monthly, angleOptimal };
};

// Interface pour la réponse attendue de l'API PVGIS Monthly
interface PVGISMonthlyResponse {
  outputs: {
    monthly: Array<{
      month: number;
      "G(i)": number; // Irradiation globale sur plan incliné (kWh/m2)
      "H(h)": number; // Irradiation globale sur plan horizontal (kWh/m2)
      T2m: number; // Température moyenne à 2m
    }>;
  };
}

interface IrradianceData {
  month: number;
  irGlobal: number;
}

// Appel 3 : TMY (température et vent horaires)
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
    let hemisphere: HemisphereValue;
    let orientation: OrientationValue;

    if (latitude > 0) {
      hemisphere = "N";
      orientation = "S"; // Plein Sud pour l'hémisphère Nord
    } else if (latitude < 0) {
      hemisphere = "S";
      orientation = "N"; // Plein Nord pour l'hémisphère Sud
    } else {
      hemisphere = "Equateur";
      orientation = "Quelconque"; // À plat ou orientation indifférente
    }

    // Calcul de l'angle d'inclinaison optimal selon les plages du guide du concepteur
    if (absLat >= 15 && absLat <= 25) {
      angle = Math.round(absLat);
    } else if (absLat > 25) {
      angle = Math.round(absLat * 0.76 + 3.1);
    } else {
      // Pour les zones à faible latitude (< 15°), on maintient 10° minimum pour l'auto-nettoyage (pluie)
      angle = 10;
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

      // console.log("-------------------------------");
      // console.log("-------------------------------");
      // console.log("-------------------------------");
      // console.log("-------------------------------");
      // console.log("Données MRcalc :", mrcalcResult);
      // console.log("-------------------------------");
      // console.log("-------------------------------");
      // console.log("-------------------------------");
      // console.log("-------------------------------");

      // PSH mensuelle depuis H(i_opt)_m
      const monthlyMetrics = monthly.map((m) => {
        const nbJours = daysInMonth(m.month);
        const diviseurJours = nbJours > 0 ? nbJours : 30;
        const diviseurHeures = (nbJours > 0 ? nbJours : 30) * 6;

        const rawValue = m["H(i_opt)_m"]; // Valeur brute reçue de l'API

        // Log de débogage pour voir ce que PVGIS renvoie réellement
        console.log(
          `Mois ${m.month}: Valeur brute PVGIS = ${rawValue} kWh/m²/mois`
        );

        return {
          month: m.month,
          // Si la valeur est en Wh, on divise par 1000 pour avoir des kWh
          // Si la valeur est en kWh, on ne divise pas par 1000
          psh: rawValue / diviseurJours,
          ir: (rawValue * 1000) / diviseurHeures,
        };
      });

      // Mois défavorable (PSH min) et favorable (PSH max)
      const stats = {
        defavorable: monthlyMetrics.reduce((prev, curr) =>
          curr.psh < prev.psh ? curr : prev
        ),
        surfavorable: monthlyMetrics.reduce((prev, curr) =>
          curr.psh > prev.psh ? curr : prev
        ),
        irMin: monthlyMetrics.reduce((prev, curr) =>
          curr.ir < prev.ir ? curr : prev
        ),
        irMax: monthlyMetrics.reduce((prev, curr) =>
          curr.ir > prev.ir ? curr : prev
        ),
      };

      // Correction climatique GIEC SSP2-4.5
      const fraction = climateFraction(targetYear);
      const dT = IPCC_DELTA.dT * fraction;
      const dG = IPCC_DELTA.dG * fraction;

      return {
        PSH: Number((stats.defavorable.psh * (1 + dG)).toFixed(3)),
        PSH_max: Number((stats.surfavorable.psh * (1 + dG)).toFixed(3)),
        G_moy: Number((stats.defavorable.psh * (1 + dG)).toFixed(3)),
        G_max: Number((stats.surfavorable.psh * (1 + dG)).toFixed(3)),

        T_min: Number((tmyResult.T_min + dT).toFixed(1)),
        T_max: Number((tmyResult.T_max + dT).toFixed(1)),

        IR_min: Number((stats.irMin.ir * (1 + dG)).toFixed(3)),
        IR_max: Number((stats.irMax.ir * (1 + dG)).toFixed(3)),

        windSpeed_mean: tmyResult.windSpeed_mean,
        windSpeed_max: tmyResult.windSpeed_max,

        angleOptimalPVGIS: angleOptimal,
        moisDefavorable: String(stats.defavorable.month),
        moisSurfavorable: String(stats.surfavorable.month),
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

      // Protection stricte contre un crash si localisation est undefined
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
        IR_min: getIrradianceMaxOffline(localisation).min,
        IR_max: getIrradianceMaxOffline(localisation).max,
        windSpeed_mean: 1.5,
        windSpeed_max: 5,
        isFallback: true,
      };
    }
  }
}

export const parametresSiteService = new ParametresSiteService();
