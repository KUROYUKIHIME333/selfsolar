import type { Localisation } from "../../types/installationPhotovoltaique.types.js";

// Utilise PVGIS (Photovoltaic Geographical Information System) de la Commission Européenne
// et calculs d'angle optimal selon latitude (p.4 du guide)

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
   * Récupère les données d'irradiation solaire via l'API PVGIS
   * Retourne les PSH (Peak Sun Hours) du mois le plus défavorable
   * pour dimensionnement conservateur (p.4 guide)
   * @param localisation Coordonnées géographiques
   * @returns Données d'irradiation et PSH
   */
  async PVGISDatas(localisation: Localisation): Promise<{
    G_moy: number; // kWh/m²/j (mois défavorable)
    G_max: number; // kWh/m²/j (mois le plus ensoleillé)
    PSH: number; // Heures de soleil de pointe équivalentes
    PSH_max: number; // Heures de soleil de pointe équivalentes au mois le plus ensolleillé
    angleOptimalPVGIS?: number; // ° (inclinaison optimale calculée)
    moisDefavorable?: string; // Nom du mois le plus défavorable
    moisSurfavorable?: string; // Nom du mois le plus favorable
  }> {
    const { lat, long } = localisation;

    // API PVGIS v5 - Monthly Radiation avec angles optimaux
    // rrad: rayonnement sur plan optimal
    // horirrad: rayonnement horizontal (pour comparaison)
    const URL = `${
      process.env.PVGIS_URL || "https://re.jrc.ec.europa.eu/api/v5.2/"
    }MRcalc?lat=${lat}&lon=${long}&optimal=1&outputformat=json`;

    try {
      const response = await fetch(URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        // Timeout pour éviter blocage
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const datas: any = await response.json();

      if (!datas.outputs || !datas.outputs.monthly) {
        throw new Error("Format de réponse PVGIS invalide");
      }

      const donnees_mensuelles = datas.outputs.monthly;

      // Recherche du mois le plus défavorable (PSH minimale)
      // C'est ce mois qui dimensionne le système (conservateur)
      const moisDefavorable = donnees_mensuelles.reduce(
        (pire: any, current: any) => {
          return current.H_h < pire.H_h ? current : pire;
        },
        donnees_mensuelles[0]
      );

      // Recherche du meilleur mois (PSH maximale)
      const moisSurfavorable = donnees_mensuelles.reduce(
        (best: any, current: any) => {
          return current.H_h > best.H_h ? current : best;
        },
        donnees_mensuelles[0]
      );

      // PSH = G_moy / 1 kW/m² (p.4 guide fait)

      return {
        G_moy: moisDefavorable.H_h, // kWh/m²/j
        G_max: moisSurfavorable.H_h, // kWh/m²/j

        PSH: moisDefavorable.H_h, // Équivalent h à 1 kW/m²
        PSH_max: moisSurfavorable.H_h, // Équivalent h à 1 kW/m²
        angleOptimalPVGIS: moisDefavorable.angle,
        moisDefavorable: moisDefavorable.month.toString(),
        moisSurfavorable: moisSurfavorable.month.toString(),
      };
    } catch (error: any) {
      console.error("Echec récupération données PVGIS:", error.message);

      // Fallback: valeurs conservatrices selon latitude si API indisponible
      const latAbs = Math.abs(lat);
      let pshFallback = 3.0;
      if (latAbs < 20) pshFallback = 4.5;
      // Équatorial
      else if (latAbs < 35) pshFallback = 4.0;
      // Subtropical
      else if (latAbs < 50) pshFallback = 2.5; // Tempéré

      console.warn(`Utilisation valeurs fallback PSH=${pshFallback}h`);

      return {
        G_moy: pshFallback,
        PSH: pshFallback,
        G_max: pshFallback, // Équivalent h à 1 kW/m²
        PSH_max: pshFallback, // Équivalent h à 1 kW/m²
      };
    }
  }
}

export const parametresSiteService = new ParametresSiteService();
