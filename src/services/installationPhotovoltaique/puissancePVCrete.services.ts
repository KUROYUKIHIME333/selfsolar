import type {
    TypeInstallationPourPertes,
    Localisation,
    PompageSolaireCaracteristiques,
    ParametresSTCPanneau,
    TemperaturesMinMax,
    TypeSystemePV,
    ParametresOnduleur
} from "../../types/installationPhotovoltaique.types.js"

// Types à ajouter dans installationPhotovoltaique.types.ts
// ---------------------------------------------------------------------------
// export interface ResultatModulesPV {
//     appareil: string;
//     tensionParcPV: number;
//     panneauxParString: number;
//     stringsEnParallele: number;
//     totalPanneaux: number;
//     puissancePVInstallee: { min: number; max: number };
// }
//
// export interface ParametresOnduleur {
//     puissanceACNominale: number;   // W
//     tensionDCMax: number;          // V — limite absolue de sécurité
//     tensionMPPTMin: number;        // V
//     tensionMPPTMax: number;        // V
//     courantDCMax: number;          // A
//     puissanceDCMax: number;        // W
//     puissanceSurcharge?: number;   // W — pic de démarrage moteurs (défaut: 1.5 × P_AC)
//     // Hybride / off-grid
//     tensionBatterieMin?: number;
//     tensionBatterieMax?: number;
//     puissanceChargeBatterieMax?: number;
// }
//
// export type TypeSystemePV = "on-grid" | "off-grid" | "hybride";
// ---------------------------------------------------------------------------

// Irradiance à laquelle est défini le NOCT (norme IEC 61215)
const IRRADIANCE_NOCT = 800;   // W/m²
const T_AMB_NOCT = 20;    // °C — température ambiante de référence NOCT
const IRRADIANCE_STC = 1000;  // W/m²

/**
 * Calcule la température de cellule à partir de la température ambiante,
 * de l'irradiance et du NOCT du module.
 *
 * Formule : T_cell = T_amb + (NOCT - T_amb_ref) / G_ref × G
 *
 * @param tAmbient   Température ambiante [°C]
 * @param irradiance Irradiance incidente [W/m²]
 * @param noct       Température nominale de cellule du module [°C]
 */
function temperatureCellule(tAmbient: number, irradiance: number, noct: number): number {
    return tAmbient + ((noct - T_AMB_NOCT) / IRRADIANCE_NOCT) * irradiance;
}

export class PuissanceCretePVService {

    async performanceRatio(typeInstallation: TypeInstallationPourPertes | string, localisation: Localisation) {
        const { lat, long } = localisation;
        let pertes_system: number = 14;

        if (typeInstallation === "HAUTE_QUALITE") pertes_system = 10;
        if (typeInstallation === "POUSSIEREUX" || typeInstallation === "FAIBLE_MAINTENANCE") pertes_system = 20;
        if (typeInstallation === "ANCIEN" || typeInstallation === "CABLE_LONG") pertes_system = 25;

        const URL = `${process.env.PVGIS_URL}PVcalc?lat=${lat}&lon=${long}&peakpower=1&loss=${pertes_system}&optimalangles=1&outputformat=json`;
        try {
            const response = await fetch(URL);
            if (!response.ok) throw new Error("Erreur");

            const datas = await response.json();
            const total_pourcentage_pertes = datas.outputs.totals.fixed.l_total;
            const performance_ratio = 1 - (total_pourcentage_pertes / 100);

            return { pertesTotales: total_pourcentage_pertes, PR: performance_ratio };
        } catch (error: any) {
            console.error("Echec du calcul des pertes et ratio de performance :", error.message);
            throw error;
        }
    }

    puissanceCretePV(
        pompageSolaire: boolean,
        energieCrete: number,
        PSH: number,
        PR: number,
        pompageSolaireCaracteristiques: PompageSolaireCaracteristiques | null | undefined,
        rendementOnduleurMTTP: number | null | undefined
    ) {
        let P_PV: number = energieCrete / (PSH * PR);

        if (pompageSolaire && pompageSolaireCaracteristiques) {
            const { masseVolumique, accelerationPesanteur, debit, hauteurMano, rendementPompe } =
                pompageSolaireCaracteristiques;

            const E_hydraulique = (masseVolumique * accelerationPesanteur * debit * hauteurMano) /
                (3600 * rendementPompe);
            const rendementOnduleur = rendementOnduleurMTTP || 1;
            P_PV = E_hydraulique / (PSH * rendementOnduleur * PR);
        }

        return P_PV;
    }

    modulesPV(
        panneauParametres: ParametresSTCPanneau,
        puissanceCretePV: number,
        temperaturesAttendue: TemperaturesMinMax,
        // ⚠ irradianceMax [W/m²] — irradiance maximale locale (ex: 1000–1200 W/m²).
        // NE PAS confondre avec la durée d'ensoleillement (PSH) en heures.
        irradianceMax: number
    ) {
        const { puissanceCreteModule, tensionMPP, tensionVoc, coeffTempTension, coeffTempPuissance, noct } =
            panneauParametres;
        const { temperatureMin, temperatureMax } = temperaturesAttendue;

        const noctModule = noct ?? 45;

        // --- Températures de cellule (pas températures ambiantes) ---
        // Pire cas froid : faible irradiance (aube/crépuscule) → Voc et Vmpp max
        // On utilise une irradiance résiduelle de 200 W/m² : plausible pour un ciel froid et clair
        const tCellMin = temperatureCellule(temperatureMin, 200, noctModule);
        // Pire cas chaud : irradiance maximale → Vmpp min, puissance min
        const tCellMax = temperatureCellule(temperatureMax, irradianceMax, noctModule);

        // --- Tensions du module corrigées en température ---
        // coeffTempTension attendu en valeur absolue par °C (ex: -0.003 /°C)
        // Si ton datasheet donne %/°C (ex: -0.30), divise par 100 avant d'appeler.
        const tension_mpp_min = tensionMPP * (1 + coeffTempTension * (tCellMax - 25));
        const tension_mpp_max = tensionMPP * (1 + coeffTempTension * (tCellMin - 25));

        // --- Puissances du module corrigées en température ---
        const puissance_crete_module_min = puissanceCreteModule * (1 + coeffTempPuissance * (tCellMax - 25));
        const puissance_crete_module_max = puissanceCreteModule * (1 + coeffTempPuissance * (tCellMin - 25));

        // --- Tension du système ---
        let tension_system: number = 12;
        if (puissanceCretePV >= 500 && puissanceCretePV < 2000) tension_system = 24;
        if (puissanceCretePV >= 2000 && puissanceCretePV < 10000) tension_system = 48;
        if (puissanceCretePV >= 10000) tension_system = 96;

        // --- Nombre de modules en série par string ---
        // tension_mpp_max correspond à la tension MPPT la plus haute (condition froide)
        // tension_mpp_min correspond à la tension MPPT la plus basse  (condition chaude)
        const nombre_strings_max = Math.floor(tension_system / tension_mpp_max);
        const nombre_strings_min = Math.ceil(tension_system / tension_mpp_min);
        const nombre_strings = Math.round((nombre_strings_max + nombre_strings_min) / 2);

        // --- Nombre de strings en parallèle ---
        const nombre_strings_parallele = Math.ceil(
            Math.ceil(puissanceCretePV / puissance_crete_module_min) / nombre_strings
        );

        const nombre_total_panneaux = nombre_strings_parallele * nombre_strings;

        const puissancePVInstalleMin = nombre_total_panneaux * puissance_crete_module_min;
        const puissancePVInstalleMax = nombre_total_panneaux * puissance_crete_module_max;

        // ⚠ Voc(tCellMin) × nombre_strings doit rester ≤ tension DC max de l'onduleur
        // Cette vérification est effectuée dans la méthode onduleur()
        const vocCelluleFroid = tensionVoc * (1 + coeffTempTension * (tCellMin - 25));

        return {
            appareil: "panneaux photovoltaiques",
            tensionParcPV: tension_system,
            panneauxParString: nombre_strings,
            stringsEnParallele: nombre_strings_parallele,
            totalPanneaux: nombre_total_panneaux,
            puissancePVInstallee: { min: puissancePVInstalleMin, max: puissancePVInstalleMax },
            // Exposé pour que onduleur() puisse vérifier Voc sans recalculer
            _vocModuleFroid: vocCelluleFroid,
            _tCellMin: tCellMin,
            _tCellMax: tCellMax,
        };
    }

    onduleur(
        resultatsModules: ReturnType<PuissanceCretePVService["modulesPV"]>,
        panneauParametres: ParametresSTCPanneau,
        temperaturesAttendue: TemperaturesMinMax,
        irradianceMax: number,
        typeSysteme: TypeSystemePV,
        puissanceChargeContinue: number,
        onduleurCandidat?: ParametresOnduleur | null,
        puissanceDemarrage?: number | null,
    ) {
        const { panneauxParString: Ns, stringsEnParallele: Np, _vocModuleFroid, _tCellMin, _tCellMax } =
            resultatsModules;
        const { tensionVoc, tensionMPP, courantCourtCircuit, courantMPP, coeffTempTension, noct } =
            panneauParametres;

        const noctModule = noct ?? 45;

        // --- Températures cellule ---
        // Si modulesPV a déjà calculé tCellMin/tCellMax, on les réutilise directement.
        // Sinon on les recalcule (cohérence garantie avec les mêmes paramètres).
        const { temperatureMin, temperatureMax } = temperaturesAttendue;
        const tCellMin = _tCellMin ?? temperatureCellule(temperatureMin, 200, noctModule);
        const tCellMax = _tCellMax ?? temperatureCellule(temperatureMax, irradianceMax, noctModule);

        // --- Grandeurs électriques du champ ---

        // Voc champ à froid — pire cas surtension absolue
        const vocModuleFroid = _vocModuleFroid ?? tensionVoc * (1 + coeffTempTension * (tCellMin - 25));
        const vocChampFroid = Ns * vocModuleFroid;

        // Vmpp champ à chaud — pire cas sous-tension MPPT (risque de décrochage)
        const vmppChampChaud = Ns * tensionMPP * (1 + coeffTempTension * (tCellMax - 25));

        // Vmpp champ nominal (25°C STC) — point de fonctionnement de référence
        const vmppNominal = Ns * tensionMPP;

        // Isc champ à irradiance max et tCellMax — pire cas courant
        // coeffTempCourant souvent ~+0.05 %/°C → impact faible, on l'ignore si non fourni
        const facteurIrradiance = irradianceMax / IRRADIANCE_STC;
        const iscChamp = Np * courantCourtCircuit * facteurIrradiance;

        // Puissance crête champ (condition chaude = valeur basse = pire cas production)
        const puissanceChampsWc = resultatsModules.puissancePVInstallee.max;

        // --- Recommandation de dimensionnement ---
        // Ratio DC/AC cible : 1.15 (tropiques), limites : [1.0 ; 1.4]
        const puissanceACMin = Math.round(puissanceChampsWc / 1.4);
        const puissanceACRecommandee = Math.round(puissanceChampsWc / 1.15);
        const puissanceACMax = Math.round(puissanceChampsWc / 1.0);

        const ratioDCAC = onduleurCandidat
            ? puissanceChampsWc / onduleurCandidat.puissanceACNominale
            : puissanceChampsWc / puissanceACRecommandee;

        let evaluationRatio: "sous-dimensionne" | "optimal" | "acceptable" | "eleve";
        if (ratioDCAC < 1.0) evaluationRatio = "sous-dimensionne";
        else if (ratioDCAC <= 1.25) evaluationRatio = "optimal";
        else if (ratioDCAC <= 1.4) evaluationRatio = "acceptable";
        else evaluationRatio = "eleve";

        // --- Vérifications compatibilité onduleur ---
        const avertissements: string[] = [];
        const erreurs: string[] = [];

        let verificationsCompatibilite: Record<string, boolean | null> = {
            vocSousLimite: null,
            vmppAuDessusMinimum: null,
            vmppDansPlageMPPT: null,
            iscSousLimite: null,
            puissanceDCOk: null,
            chargeACOk: null,
            surchargeOk: null,
        };

        if (onduleurCandidat) {
            const vocOk = vocChampFroid < onduleurCandidat.tensionDCMax;
            const vmppMin = vmppChampChaud > onduleurCandidat.tensionMPPTMin;
            const vmppMax = vmppNominal <= onduleurCandidat.tensionMPPTMax;
            const iscOk = iscChamp <= onduleurCandidat.courantDCMax;
            const pdcOk = puissanceChampsWc <= onduleurCandidat.puissanceDCMax * 1.4;
            const chargeOk = onduleurCandidat.puissanceACNominale >= puissanceChargeContinue;

            const puissanceSurcharge = onduleurCandidat.puissanceSurcharge
                ?? onduleurCandidat.puissanceACNominale * 1.5;
            const surchargeOk = puissanceDemarrage != null
                ? puissanceSurcharge >= puissanceDemarrage
                : null;

            verificationsCompatibilite = {
                vocSousLimite: vocOk,
                vmppAuDessusMinimum: vmppMin,
                vmppDansPlageMPPT: vmppMin && vmppMax,
                iscSousLimite: iscOk,
                puissanceDCOk: pdcOk,
                chargeACOk: chargeOk,
                surchargeOk,
            };

            if (!vocOk)
                erreurs.push(
                    `Voc champ à froid (${vocChampFroid.toFixed(1)} V) ≥ tensionDCMax onduleur (${onduleurCandidat.tensionDCMax} V) — DANGER`
                );
            if (!vmppMin)
                avertissements.push(
                    `Vmpp champ à chaud (${vmppChampChaud.toFixed(1)} V) < tensionMPPTMin (${onduleurCandidat.tensionMPPTMin} V) — risque de décrochage MPPT`
                );
            if (!vmppMax)
                avertissements.push(
                    `Vmpp nominal (${vmppNominal.toFixed(1)} V) > tensionMPPTMax (${onduleurCandidat.tensionMPPTMax} V) — perte de production`
                );
            if (!iscOk)
                erreurs.push(
                    `Isc champ (${iscChamp.toFixed(2)} A) > courantDCMax onduleur (${onduleurCandidat.courantDCMax} A) — DANGER`
                );
            if (!pdcOk)
                avertissements.push(
                    `Ratio DC/AC (${ratioDCAC.toFixed(2)}) > 1.4 — clipping important, vérifier avec simulation`
                );
            if (!chargeOk)
                erreurs.push(
                    `Puissance AC onduleur (${onduleurCandidat.puissanceACNominale} W) < charge continue (${puissanceChargeContinue} W)`
                );
            if (surchargeOk === false)
                avertissements.push(
                    `Capacité de surcharge (${puissanceSurcharge} W) insuffisante pour le démarrage (${puissanceDemarrage} W requis)`
                );
            if (evaluationRatio === "sous-dimensionne")
                avertissements.push(`Ratio DC/AC faible (${ratioDCAC.toFixed(2)}) — onduleur probablement surdimensionné`);
            if (evaluationRatio === "eleve")
                avertissements.push(`Ratio DC/AC élevé (${ratioDCAC.toFixed(2)}) — clipping significatif attendu`);
        }

        return {
            appareil: "onduleur",
            typeSysteme,
            grandeursChamp: {
                tCellMin: parseFloat(tCellMin.toFixed(1)),
                tCellMax: parseFloat(tCellMax.toFixed(1)),
                vocChampFroid: parseFloat(vocChampFroid.toFixed(2)),
                vmppChampChaud: parseFloat(vmppChampChaud.toFixed(2)),
                vmppNominal: parseFloat(vmppNominal.toFixed(2)),
                iscChamp: parseFloat(iscChamp.toFixed(3)),
                puissanceChampsWc,
            },
            dimensionnement: {
                puissanceACMin,
                puissanceACRecommandee,
                puissanceACMax,
                ratioDCAC: parseFloat(ratioDCAC.toFixed(3)),
                evaluationRatio,
            },
            verification: onduleurCandidat
                ? { compatible: erreurs.length === 0, details: verificationsCompatibilite }
                : null,
            avertissements,
            erreurs,
        };
    }
}

export const puissanceCretePVService = new PuissanceCretePVService();