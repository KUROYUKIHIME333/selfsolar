import type { TypeInstallationPourPertes, Localisation, PompageSolaireCaracteristiques, ParametresSTCPanneau, TemperaturesMinMax } from "../../types/installationPhotovoltaique.types.js"

export class PuissanceCretePVService {
    async performanceRatio(typeInstallation: TypeInstallationPourPertes | string, localisation: Localisation) {
        const { lat, long } = localisation;
        let pertes_system: number = 14;

        // PERTES PAR TYPE D'INSTALLATION
        if (typeInstallation === "HAUTE_QUALITE") {
            pertes_system = 10;
        };
        if (typeInstallation === "POUSSIEREUX" || typeInstallation === "FAIBLE_MAINTENANCE") {
            pertes_system = 20;
        };
        if (typeInstallation === "ANCIEN" || typeInstallation === "CABLE_LONG") {
            pertes_system = 25;
        };

        const URL = `${process.env.PVGIS_URL}PVcalc?lat=${lat}&lon=${long}&peakpower=1&loss=${pertes_system}&optimalangles=1&outputformat=json`;
        try {
            const response = await fetch(URL);

            if (!response.ok) {
                throw new Error("Erreur")
            };

            const datas = await response.json();

            const total_pourcentage_pertes = datas.outputs.totals.fixed.l_total;
            const performance_ratio = 1 - (total_pourcentage_pertes / 100);

            return {
                pertesTotales: total_pourcentage_pertes,
                PR: performance_ratio
            };
        } catch (error: any) {
            console.error("Echec du calcul des pertes et ratio de performance :", error.message)
            throw error
        }
    };

    puissanceCretePV(pompageSolaire: boolean, energieCrete: number, PSH: number, PR: number, pompageSolaireCaracteristiques: PompageSolaireCaracteristiques | null | undefined, rendementOnduleurMTTP: number | null | undefined) {
        let P_PV: number;

        // P_PV [Wc] = E_charge [Wh/j] / (PSH [h] × PR)
        const puissance_crête = energieCrete / (PSH * PR);

        P_PV = puissance_crête;

        if (pompageSolaire && pompageSolaireCaracteristiques) {
            const {
                batteries,
                masseVolumique,
                accelerationPesanteur,
                debit,
                hauteurMano,
                rendementPompe } = pompageSolaireCaracteristiques;

            const E_hydraulique = masseVolumique * accelerationPesanteur * debit * hauteurMano / (3600 * rendementPompe);
            const rendementOnduleur = rendementOnduleurMTTP || 1;
            const P_PV_pompe = E_hydraulique / (PSH * rendementOnduleur * PR);

            P_PV = P_PV_pompe;
        }

        return P_PV;
    };

    modulesPV(panneauParametres: ParametresSTCPanneau, puissanceCretePV: number, temperaturesAttendue: TemperaturesMinMax, dureeEnsoleillement: number) {
        const { puissanceCreteModule, tensionMPP, coeffTempTension, coeffTempPuissance } = panneauParametres;
        const { temperatureMin, temperatureMax } = temperaturesAttendue;
        let tension_system: number = 12;

        // Tension du systeme
        if (puissanceCretePV >= 500 && puissanceCretePV < 2000) {
            tension_system = 24;
        };
        if (puissanceCretePV >= 2000 && puissanceCretePV < 10000) {
            tension_system = 48;
        };
        if (puissanceCretePV >= 10000) {
            tension_system = 96;
        };

        // Correction de tension selon température (T en °C par rapport à STC)
        const tension_mpp_min = tensionMPP * (1 + coeffTempTension * (temperatureMax - 25));
        const tension_mpp_max = tensionMPP * (1 + coeffTempTension * (temperatureMin - 25));

        // Correction de la puissance selon température (T en °C par rapport à STC)
        const puissance_crete_module_min = puissanceCreteModule * (1 + coeffTempPuissance * (temperatureMax - 25));
        const puissance_crete_module_max = puissanceCreteModule * (1 + coeffTempPuissance * (temperatureMin - 25));

        //Nombre de strings (modules montés en serie)
        // Modules en série (par string) : la tension DC doit être compatible avec la plage MPPT de l'onduleur.
        const nombre_strings_max = Math.floor(tension_system / tension_mpp_max);
        const nombre_strings_min = Math.ceil(tension_system / tension_mpp_min);
        const nombre_strings = Math.round((nombre_strings_max + nombre_strings_min) / 2);

        // Strings en parallele
        const nombre_strings_parallele = Math.ceil(Math.ceil(puissanceCretePV / puissance_crete_module_min) / nombre_strings);

        // Nombre total de panneaux
        const nombre_total_panneaux = nombre_strings_parallele * nombre_strings;

        // Puissance PV installée
        const puissancePVInstalleMin = nombre_total_panneaux * puissance_crete_module_min;
        const puissancePVInstalleMax = nombre_total_panneaux * puissance_crete_module_max;

        // ⚠ NOTE : Vérifier que Voc(T_min) × N_série ≤ tension max admissible de l'onduleur (typiquement
        // 600 V, 1000 V ou 1500 V selon gamme)

        return {
            appareil: "panneaux photovoltaiques",
            tensionParcPV: tension_system, // en V DC
            panneauxParString: nombre_strings,
            stringsEnParallele: nombre_strings_parallele,
            totalPanneaux: nombre_total_panneaux,
            puissancePVInstallee: {
                min: puissancePVInstalleMin,
                max: puissancePVInstalleMax
            }
        }
    };

    onduleur() { }; // TODO: continuer
};

export const puissanceCretePVService = new PuissanceCretePVService();