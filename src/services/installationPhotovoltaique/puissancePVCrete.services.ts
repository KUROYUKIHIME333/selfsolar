import type { TypeInstallationPourPertes, Localisation, PompageSolaireCaracteristiques } from "../../types/installationPhotovoltaique.types.js"

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

    modulesPV(){};
};

export const puissanceCretePVService = new PuissanceCretePVService();