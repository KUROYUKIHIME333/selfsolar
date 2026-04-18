import type { Localisation } from "../../types/installationPhotovoltaique.types.js";

// Service de détermination des paramètres du site solaire
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
        let hemisphere: string;
        let orientation: string;

        // Détermination hémisphère et orientation (vers équateur)
        if (latitude >= 0) {
            hemisphere = "N";
            orientation = "S"; // Sud pour hémisphère nord
        } else {
            hemisphere = "S";
            orientation = "N"; // Nord pour hémisphère sud
        }

        // Calcul angle optimal selon latitude (p.4 guide)
        if (absLat < 15) {
            // Zones équatoriales: quasi-horizontal pour capter diffuse
            angle = (absLat * 0.9) + 1;
        } else if (absLat >= 15 && absLat <= 25) {
            // Zones tropicales/subtropicales: angle = latitude
            angle = absLat;
        } else {
            // Zones tempérées/froides: angle optimisé hiver
            angle = (absLat * 0.76) + 3.1;
        }

        // Minimum 10° pour évacuation eau de pluie et nettoyage naturel
        const angleFinal = angle < 10 ? 10 : Math.round(angle);

        return {
            hemisphère: hemisphere,
            orientation: orientation,
            angle: angleFinal
        };
    }

    /**
     * Récupère les données d'irradiation solaire via l'API PVGIS
     * Retourne les PSH (Peak Sun Hours) du mois le plus défavorable
     * pour dimensionnement conservateur (p.4 guide)
     * 
     * @param localisation Coordonnées géographiques
     * @returns Données d'irradiation et PSH
     */
    async PVGISDatas(localisation: Localisation): Promise<{
        G_moy: number;              // kWh/m²/j (mois défavorable)
        PSH: number;                // Heures de soleil de pointe équivalentes
        angleOptimalPVGIS?: number;  // ° (inclinaison optimale calculée)
        moisDefavorable: string;     // Nom du mois le plus défavorable
    }> {
        const { lat, long } = localisation;

        // API PVGIS v5 - Monthly Radiation avec angles optimaux
        // rrad: rayonnement sur plan optimal
        // horirrad: rayonnement horizontal (pour comparaison)
        const URL = `${process.env.PVGIS_URL || "https://re.jrc.ec.europa.eu/api/v5.2/"}MRcalc?lat=${lat}&lon=${long}&optimal=1&outputformat=json`;

        try {
            const response = await fetch(URL, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                // Timeout pour éviter blocage
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const datas = await response.json();

            if (!datas.outputs || !datas.outputs.monthly) {
                throw new Error("Format de réponse PVGIS invalide");
            }

            const donnees_mensuelles = datas.outputs.monthly;

            // Recherche du mois le plus défavorable (PSH minimale)
            // C'est ce mois qui dimensionne le système (conservateur)
            const moisDefavorable = donnees_mensuelles.reduce((pire: any, current: any) => {
                return (current.H_h < pire.H_h) ? current : pire;
            }, donnees_mensuelles[0]);

            // PSH = G_moy / 1 kW/m² (p.4 guide)
            // H_h est déjà en kWh/m²/j, donc PSH = H_h numériquement
            const G_moy = moisDefavorable.H_h;      // kWh/m²/j
            const PSH = moisDefavorable.H_h;        // Équivalent h à 1 kW/m²

            return {
                G_moy: G_moy,
                PSH: PSH,
                angleOptimalPVGIS: moisDefavorable.angle,
                moisDefavorable: moisDefavorable.month.toString()
            };

        } catch (error: any) {
            console.error("Echec récupération données PVGIS:", error.message);

            // Fallback: valeurs conservatrices selon latitude si API indisponible
            const latAbs = Math.abs(lat);
            let pshFallback = 3.0;
            if (latAbs < 20) pshFallback = 4.5;      // Équatorial
            else if (latAbs < 35) pshFallback = 4.0;  // Subtropical
            else if (latAbs < 50) pshFallback = 2.5;  // Tempéré

            console.warn(`Utilisation valeurs fallback PSH=${pshFallback}h`);

            return {
                G_moy: pshFallback,
                PSH: pshFallback,
                moisDefavorable: "Fallback (API indisponible)"
            };
        }
    }
}

export const parametresSiteService = new ParametresSiteService();