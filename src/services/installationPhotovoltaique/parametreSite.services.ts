import type { Localisation } from "../../types/installationPhotovoltaique.types.js"

export class ParametresSiteService {
    angleOptimal(latitude: number) {
        const absLat = Math.abs(latitude);

        let angle: number = 10;
        let hemisphere: string = "0";
        let orientation: string = "0";

        // Hemisphere et orientation
        if (latitude > 0) {
            hemisphere = "N";
            orientation = "S";
        }
        if (latitude < 0) {
            hemisphere = "S";
            orientation = "N";
        }

        // Angle des panneaux
        if (absLat < 15) {
            angle = (absLat * 0.9) + 1;
        };
        if (absLat >= 15 && absLat <= 25) {
            angle = absLat;
        };
        if (absLat > 25) {
            angle = (absLat * 0.76) + 3.1
        };

        const parameters = {
            hemisphère: hemisphere,
            orientation: orientation,
            angle: angle < 10 ? 10 : Math.round(angle)
        };

        return parameters;
    };

    async PVGISDatas(localisation: Localisation) {
        const { lat, long } = localisation;
        const URL = `${process.env.PVGIS_URL}MRcalc?lat=${lat}&lon=${long}&rrad=1&horirrad=1&outputformat=json`;

        try {
            const response = await fetch(URL);
            const datas = await response.json();
            const donnees_mensuelles = datas.outputs.monthly;

            const irradiation_minimale = donnees_mensuelles.reduce((last: any, now: any) => {
                return (now.H_h < last.H_h) ? now : last;
            }, donnees_mensuelles[0]);

            return {
                G_moy: irradiation_minimale, // en kWh/m²/j
                PSH: irradiation_minimale, // G_moyenne (en kWh/m²/j) / 1 kw/m²
            }
        } catch (error: any) {
            console.error("Echec récupération des données ensoleillement :", error.message)
            throw error
        }
    };
};

export const parametresSiteService = new ParametresSiteService();