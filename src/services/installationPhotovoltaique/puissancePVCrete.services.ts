// services/puissancePVCrete.services.ts

import type {
    TypeInstallationPourPertes,
    Localisation,
    PompageSolaireCaracteristiques,
    ParametresSTCPanneau,
    TemperaturesMinMax,
    TypeSystemePV,
    ParametresOnduleur,
    ContraintesOnduleurModules,
    ResultatModulesPV,
    ResultatOnduleur
} from "../../types/installationPhotovoltaique.types.js";

// Constantes physiques et normatives
const IRRADIANCE_NOCT = 800;        // W/m² - Condition NOCT (p.5 guide)
const T_AMB_NOCT = 20;              // °C - Température ambiante référence NOCT
const IRRADIANCE_STC = 1000;        // W/m² - Standard Test Conditions

/**
 * Calcule la température de cellule selon modèle NOCT (p.4-5 guide)
 * Formule: T_cell = T_amb + (NOCT - 20) × G / 800
 * 
 * @param tAmbient Température ambiante (°C)
 * @param irradiance Irradiance incidente (W/m²)
 * @param noct Température nominale de cellule du module (°C)
 * @returns Température de cellule estimée (°C)
 */
function temperatureCellule(tAmbient: number, irradiance: number, noct: number): number {
    // Protection: irradiance minimale pour éviter températures aberrantes
    const G_eff = Math.max(irradiance, 100);
    return tAmbient + ((noct - T_AMB_NOCT) / IRRADIANCE_NOCT) * G_eff;
}

/**
 * Service de dimensionnement de la puissance crête PV et des composants
 * Conforme IEC 61215 (modules), IEC 62109 (onduleurs), NF EN 50549 (injection)
 */
export class PuissanceCretePVService {

    /**
     * Calcule le Performance Ratio (PR) via PVGIS ou estimations normatives
     * Le PR intègre toutes les pertes système (température, câblage, MPPT, etc.)
     * Valeur typique: 0.75-0.85 (p.4 guide)
     * 
     * @param typeInstallation Type d'installation (qualité, maintenance, etc.)
     * @param localisation Coordonnées pour appel PVGIS
     * @returns Pertes totales (%) et PR (0-1)
     */
    async performanceRatio(
        typeInstallation: TypeInstallationPourPertes | string,
        localisation: Localisation
    ): Promise<{ pertesTotales: number; PR: number }> {

        // Pertes système selon qualité installation (p.4 guide)
        // Standard: 18-22% pertes → PR = 0.78-0.82
        let pertes_system: number = 18; // Standard

        switch (typeInstallation) {
            case "HAUTE_QUALITE": pertes_system = 10; break;      // PR ~0.90
            case "STANDARD": pertes_system = 18; break;            // PR ~0.82
            case "POUSSIEREUX": pertes_system = 22; break;         // PR ~0.78
            case "FAIBLE_MAINTENANCE": pertes_system = 25; break;  // PR ~0.75
            case "ANCIEN": pertes_system = 28; break;              // PR ~0.72
            case "CABLE_LONG": pertes_system = 25; break;          // PR ~0.75
        }

        try {
            // Appel PVGIS pour obtenir PR réel du site
            const URL = `${process.env.PVGIS_URL || "https://re.jrc.ec.europa.eu/api/v5.2/"}PVcalc?lat=${localisation.lat}&lon=${localisation.long}&peakpower=1&loss=${pertes_system}&optimalangles=1&outputformat=json`;

            const response = await fetch(URL, { signal: AbortSignal.timeout(15000) });

            if (!response.ok) throw new Error(`PVGIS erreur HTTP ${response.status}`);

            const datas: any = await response.json();

            if (datas.outputs?.totals?.fixed?.l_total !== undefined) {
                const total_pourcentage_pertes = datas.outputs.totals.fixed.l_total;
                const performance_ratio = 1 - (total_pourcentage_pertes / 100);

                return {
                    pertesTotales: total_pourcentage_pertes,
                    PR: performance_ratio
                };
            }

            throw new Error("Structure réponse PVGIS inattendue");

        } catch (error: any) {
            console.warn("PVGIS PR indisponible, utilisation estimation:", error.message);

            // Fallback: PR estimé basé sur pertes configurées
            const PR_fallback = 1 - (pertes_system / 100);
            return {
                pertesTotales: pertes_system,
                PR: PR_fallback
            };
        }
    }

    /**
     * Calcule la puissance crête PV nécessaire
     * 
     * Standard: P_PV = E_charge / (PSH × PR)
     * Pompage: P_PV = E_hydraulique / (PSH × η_onduleur × PR) (p.4-5 guide)
     * 
     * @param pompageSolaire true si application pompage
     * @param energieCrete Énergie journalière requise (Wh/j) ou énergie hydraulique
     * @param PSH Peak Sun Hours du mois défavorable (h/j)
     * @param PR Performance Ratio (0-1)
     * @param pompageCaracteristiques Paramètres pompage si applicable
     * @param rendementOnduleurMTTP Rendement MPPT (défaut 0.98)
     * @returns Puissance crête PV requise (Wc)
     */
    puissanceCretePV(
        pompageSolaire: boolean,
        energieCrete: number,           // Wh/j (consommation ou énergie hydraulique)
        PSH: number,                    // h/j
        PR: number,                     // 0-1
        pompageCaracteristiques: PompageSolaireCaracteristiques | null | undefined,
        rendementOnduleurMTTP: number | null | undefined
    ): number {

        let P_PV: number;

        if (pompageSolaire && pompageCaracteristiques) {
            // Dimensionnement pompage solaire (p.5 guide)
            // E_hydraulique = ρ × g × Q × H_man / (3600 × η_pompe)
            const {
                masseVolumique,
                accelerationPesanteur,
                debit,
                hauteurMano,
                rendementPompe
            } = pompageCaracteristiques;

            const E_hydraulique = (masseVolumique * accelerationPesanteur * debit * hauteurMano) /
                (3600 * rendementPompe);

            const rendementOnduleur = rendementOnduleurMTTP ?? 0.98;

            // P_PV_pompe = E_hydraulique / (PSH × η_onduleur × PR_réduit)
            // PR_réduit car pas de batterie tampon en pompage direct
            const PR_reduit = PR * 0.95; // Perte supplémentaire variabilité
            P_PV = E_hydraulique / (PSH * rendementOnduleur * PR_reduit);

        } else {
            // Dimensionnement standard (p.4 guide)
            // P_PV [Wc] = E_charge [Wh/j] / (PSH [h] × PR)
            P_PV = energieCrete / (PSH * PR);
        }

        return Math.ceil(P_PV); // Arrondi supérieur pour sécurité
    }

    /**
     * CORRIGÉ: Dimensionnement du champ de modules avec contraintes onduleur réelles
     * Basé sur NFC 15-100 §771 et IEC 62109 (p.5-6 guide)
     * 
     * Pour onduleurs modernes: utiliser plage MPPT (100-800V typique)
     * Pour systèmes batterie: utiliser tension système (12/24/48V)
     * 
     * @param panneauParametres Caractéristiques STC du module
     * @param puissanceCretePV Puissance crête requise (Wc)
     * @param temperaturesAttendue Températures min/max ambiantes
     * @param irradianceMax Irradiance max locale (W/m², typiquement 1000-1200)
     * @param contraintesOnduleur Contraintes MPPT et sécurité (null si batterie basse tension)
     * @param tensionSystemeBatterie Tension batterie pour off-grid (12/24/48V)
     * @returns Configuration modules avec vérifications de tension
     */
    modulesPV(
        panneauParametres: ParametresSTCPanneau,
        puissanceCretePV: number,
        temperaturesAttendue: TemperaturesMinMax,
        irradianceMax: number,
        contraintesOnduleur: ContraintesOnduleurModules | null,
        tensionSystemeBatterie?: number
    ): ResultatModulesPV {

        const {
            puissanceCreteModule,
            tensionMPP,
            tensionVoc,
            coeffTempTension,
            coeffTempPuissance,
            noct
        } = panneauParametres;

        const { temperatureMin, temperatureMax } = temperaturesAttendue;
        const noctModule = noct ?? 45;

        // --- Calcul températures de cellule ---
        // Condition froide: faible irradiance (aube/crépuscule) → Voc max
        // Utilisation 200 W/m² pour ciel clair froid
        const tCellMin = temperatureCellule(temperatureMin, 200, noctModule);

        // Condition chaude: irradiance max → Vmpp min, P min
        const tCellMax = temperatureCellule(temperatureMax, irradianceMax, noctModule);

        // --- Tensions corrigées en température ---
        // β en valeur absolue (ex: -0.35%/°C → 0.0035 /°C)
        const facteurTempMin = 1 + coeffTempTension * (tCellMin - 25);  // Froid
        const facteurTempMax = 1 + coeffTempTension * (tCellMax - 25);  // Chaud

        // Vmpp: chaud = tension basse, froid = tension haute
        const tension_mpp_min = tensionMPP * facteurTempMax;   // Condition chaude (pire cas MPPT)
        const tension_mpp_max = tensionMPP * facteurTempMin;   // Condition froide
        const voc_module_froid = tensionVoc * facteurTempMin;  // Voc max à froid (CRITIQUE sécurité)

        // --- Détermination Ns (modules en série) ---
        let Ns_min: number;
        let Ns_max: number;
        let configuration: "haute_tension" | "basse_tension";

        if (contraintesOnduleur) {
            // CAS ON-GRID / HYBRIDE / ONDULEUR MPPT HAUTE TENSION
            // N_série_max = V_MPPT_max_onduleur / V_mpp_module_à_T_min (p.5 guide)
            // N_série_min = V_MPPT_min_onduleur / V_mpp_module_à_T_max

            Ns_max = Math.floor(contraintesOnduleur.tensionMPPTMax / tension_mpp_max);
            Ns_min = Math.ceil(contraintesOnduleur.tensionMPPTMin / tension_mpp_min);

            // VÉRIFICATION SÉCURITÉ: Voc à froid < tension DC max onduleur (p.5 guide)
            // ⚠ C'est la contrainte absolue de sécurité
            const vocChampFroidEstime = Ns_max * voc_module_froid;
            if (vocChampFroidEstime > contraintesOnduleur.tensionDCMax) {
                // Réduction Ns_max pour respecter limite sécurité
                const Ns_max_securite = Math.floor(contraintesOnduleur.tensionDCMax / voc_module_froid);
                console.warn(`Ajustement Ns pour sécurité: ${Ns_max} → ${Ns_max_securite} (Voc limit)`);
                Ns_max = Ns_max_securite;
            }

            configuration = "haute_tension";

        } else if (tensionSystemeBatterie) {
            // CAS OFF-GRID BASSE TENSION (PWM ou MPPT 12/24/48V)
            // Tension de charge batterie: 14.4V (12V), 28.8V (24V), 57.6V (48V)
            const tensionChargeMax = tensionSystemeBatterie * 1.25; // Marge régulateur
            const tensionChargeMin = tensionSystemeBatterie * 0.85; // Décharge profonde

            Ns_max = Math.floor(tensionChargeMax / tension_mpp_max);
            Ns_min = Math.ceil(tensionChargeMin / tension_mpp_min);
            configuration = "basse_tension";

        } else {
            throw new Error(
                "Dimensionnement modules: soit 'contraintesOnduleur', soit 'tensionSystemeBatterie' doit être fourni"
            );
        }

        // Vérification faisabilité
        if (Ns_min > Ns_max) {
            throw new Error(
                `Impossible de dimensionner: Ns_min (${Ns_min}) > Ns_max (${Ns_max}). ` +
                `Vérifiez les contraintes de tension onduleur ou tension batterie.`
            );
        }

        // Choix optimal: valeur médiane pour centrer dans plage MPPT
        const Ns = Math.round((Ns_min + Ns_max) / 2);

        // --- Calcul Np (strings en parallèle) ---
        // Puissance module à chaud (déclassée)
        const puissanceModuleChaud = puissanceCreteModule *
            (1 + coeffTempPuissance * (tCellMax - 25));

        // Nombre total modules minimum pour puissance requise
        const nbModulesMin = Math.ceil(puissanceCretePV / puissanceModuleChaud);
        const Np = Math.ceil(nbModulesMin / Ns);

        const totalPanneaux = Ns * Np;

        // Puissances installées (min à chaud, max à froid)
        const puissanceModuleFroid = puissanceCreteModule *
            (1 + coeffTempPuissance * (tCellMin - 25));

        const puissancePVInstalleeMin = totalPanneaux * puissanceModuleChaud;
        const puissancePVInstalleeMax = totalPanneaux * puissanceModuleFroid;

        return {
            appareil: "panneaux photovoltaiques",
            configuration,
            tensionParcPV: configuration === "basse_tension" ? tensionSystemeBatterie : undefined,
            panneauxParString: Ns,
            stringsEnParallele: Np,
            totalPanneaux: totalPanneaux,
            tensionStringSTC: Ns * tensionMPP,
            tensionStringMin: Ns * tension_mpp_min,   // Vmpp condition chaude
            tensionStringMax: Ns * tension_mpp_max,   // Vmpp condition froide
            vocStringFroid: Ns * voc_module_froid,    // VOC CRITIQUE sécurité
            puissancePVInstallee: {
                min: Math.round(puissancePVInstalleeMin),
                max: Math.round(puissancePVInstalleeMax)
            },
            _temperaturesCellule: {
                tCellMin: Math.round(tCellMin * 10) / 10,
                tCellMax: Math.round(tCellMax * 10) / 10
            },
            _tensionModuleCorrigee: {
                mppMin: Math.round(tension_mpp_min * 100) / 100,
                mppMax: Math.round(tension_mpp_max * 100) / 100,
                vocFroid: Math.round(voc_module_froid * 100) / 100
            }
        };
    }

    /**
     * Vérification et dimensionnement onduleur
     * Ratio DC/AC cible: 1.15 (tropiques), limites [1.0-1.4] (p.6 guide)
     * 
     * @param resultatsModules Résultat de modulesPV()
     * @param panneauParametres Paramètres modules
     * @param temperaturesAttendue Températures ambiantes
     * @param irradianceMax Irradiance max (W/m²)
     * @param typeSysteme Type de système PV
     * @param puissanceChargeContinue Puissance charge continue (W)
     * @param onduleurCandidat Paramètres onduleur candidat (optionnel)
     * @param puissanceDemarrage Puissance démarrage moteurs (optionnel)
     * @returns Résultat complet avec vérifications
     */
    onduleur(
        resultatsModules: ResultatModulesPV,
        panneauParametres: ParametresSTCPanneau,
        temperaturesAttendue: TemperaturesMinMax,
        irradianceMax: number,
        typeSysteme: TypeSystemePV,
        puissanceChargeContinue: number,
        onduleurCandidat?: ParametresOnduleur | null,
        puissanceDemarrage?: number | null
    ): ResultatOnduleur {

        const {
            panneauxParString: Ns,
            stringsEnParallele: Np,
            vocStringFroid,
            _temperaturesCellule,
            _tensionModuleCorrigee,
            puissancePVInstallee
        } = resultatsModules;

        const {
            tensionVoc,
            tensionMPP,
            courantCourtCircuit: Isc,
            coeffTempTension,
            noct
        } = panneauParametres;

        const noctModule = noct ?? 45;
        const { temperatureMin, temperatureMax } = temperaturesAttendue;

        // Recalcul ou réutilisation températures
        const tCellMin = _temperaturesCellule?.tCellMin ??
            temperatureCellule(temperatureMin, 200, noctModule);
        const tCellMax = _temperaturesCellule?.tCellMax ??
            temperatureCellule(temperatureMax, irradianceMax, noctModule);

        // --- Grandeurs électriques du champ ---

        // Voc champ à froid (sécurité absolue)
        const vocModuleFroid = _tensionModuleCorrigee?.vocFroid ??
            tensionVoc * (1 + coeffTempTension * (tCellMin - 25));
        const vocChampFroidCalc = Ns * vocModuleFroid;

        // Vmpp champ à chaud (risque décrochage MPPT)
        const vmppModuleChaud = _tensionModuleCorrigee?.mppMin ??
            tensionMPP * (1 + coeffTempTension * (tCellMax - 25));
        const vmppChampChaud = Ns * vmppModuleChaud;

        // Vmpp nominal (STC)
        const vmppNominal = Ns * tensionMPP;

        // Isc champ à irradiance max (pire cas courant)
        const facteurIrradiance = irradianceMax / IRRADIANCE_STC;
        const iscChamp = Np * Isc * facteurIrradiance;

        // Puissance champ (pire cas = chaud = min)
        const puissanceChampsWc = puissancePVInstallee.max;

        // --- Dimensionnement recommandé ---
        // Ratio DC/AC selon ensoleillement (p.6 guide)
        // Fort ensoleillement (Afrique): 1.20-1.40
        // Modéré (Europe sud): 1.10-1.25  
        // Faible (Europe nord): 1.00-1.15
        const ratioCible = 1.15; // Valeur standard
        const ratioMin = 1.0;
        const ratioMax = 1.4;

        const puissanceACMin = Math.round(puissanceChampsWc / ratioMax);
        const puissanceACRecommandee = Math.round(puissanceChampsWc / ratioCible);
        const puissanceACMax = Math.round(puissanceChampsWc / ratioMin);

        const ratioDCAC = onduleurCandidat
            ? puissanceChampsWc / onduleurCandidat.puissanceACNominale
            : puissanceChampsWc / puissanceACRecommandee;

        // Évaluation ratio
        let evaluationRatio: ResultatOnduleur["dimensionnement"]["evaluationRatio"];
        if (ratioDCAC < ratioMin) evaluationRatio = "sous-dimensionne";
        else if (ratioDCAC <= 1.25) evaluationRatio = "optimal";
        else if (ratioDCAC <= ratioMax) evaluationRatio = "acceptable";
        else evaluationRatio = "eleve";

        // --- Vérifications compatibilité ---
        const avertissements: string[] = [];
        const erreurs: string[] = [];

        // let verificationsCompatibilite: ResultatOnduleur["verification"]["details"]| null = null;
        let verificationsCompatibilite: Exclude<ResultatOnduleur["verification"], null>["details"] | null = null;


        if (onduleurCandidat) {
            const vocOk = vocChampFroidCalc < onduleurCandidat.tensionDCMax;
            const vmppMinOk = vmppChampChaud > onduleurCandidat.tensionMPPTMin;
            const vmppMaxOk = vmppNominal <= onduleurCandidat.tensionMPPTMax;
            const vmppPlageOk = vmppMinOk && vmppMaxOk;
            const iscOk = iscChamp <= onduleurCandidat.courantDCMax;
            const pdcOk = puissanceChampsWc <= (onduleurCandidat.puissanceDCMax ||
                onduleurCandidat.puissanceACNominale * 1.5) * 1.4;
            const chargeOk = onduleurCandidat.puissanceACNominale >= puissanceChargeContinue;

            const puissanceSurcharge = onduleurCandidat.puissanceSurcharge ??
                onduleurCandidat.puissanceACNominale * 1.5;
            const surchargeOk = puissanceDemarrage != null
                ? puissanceSurcharge >= puissanceDemarrage
                : null;

            verificationsCompatibilite = {
                vocSousLimite: vocOk,
                vmppAuDessusMinimum: vmppMinOk,
                vmppDansPlageMPPT: vmppPlageOk,
                iscSousLimite: iscOk,
                puissanceDCOk: pdcOk,
                chargeACOk: chargeOk,
                surchargeOk
            };

            // Messages d'erreur/avertissement
            if (!vocOk) {
                erreurs.push(
                    `CRITIQUE: Voc champ à froid (${vocChampFroidCalc.toFixed(1)} V) ≥ ` +
                    `tensionDCMax onduleur (${onduleurCandidat.tensionDCMax} V) - RISQUE DESTRUCTION`
                );
            }
            if (!vmppMinOk) {
                avertissements.push(
                    `Vmpp champ à chaud (${vmppChampChaud.toFixed(1)} V) < ` +
                    `tensionMPPTMin (${onduleurCandidat.tensionMPPTMin} V) - Risque décrochage MPPT hiver`
                );
            }
            if (!vmppMaxOk) {
                avertissements.push(
                    `Vmpp nominal (${vmppNominal.toFixed(1)} V) > ` +
                    `tensionMPPTMax (${onduleurCandidat.tensionMPPTMax} V) - Perte production été`
                );
            }
            if (!iscOk) {
                erreurs.push(
                    `Isc champ (${iscChamp.toFixed(2)} A) > courantDCMax ` +
                    `(${onduleurCandidat.courantDCMax} A) - Surcharge entrée DC`
                );
            }
            if (!pdcOk) {
                avertissements.push(
                    `Ratio DC/AC (${ratioDCAC.toFixed(2)}) élevé - Clipping significatif envisageable`
                );
            }
            if (!chargeOk) {
                erreurs.push(
                    `Puissance AC onduleur (${onduleurCandidat.puissanceACNominale} W) < ` +
                    `charge continue (${puissanceChargeContinue} W) - Sous-dimensionnement`
                );
            }
            if (surchargeOk === false) {
                avertissements.push(
                    `Capacité surcharge (${puissanceSurcharge} W) < démarrage requis (${puissanceDemarrage} W)`
                );
            }
        }

        return {
            appareil: "onduleur",
            typeSysteme,
            grandeursChamp: {
                tCellMin: Math.round(tCellMin * 10) / 10,
                tCellMax: Math.round(tCellMax * 10) / 10,
                vocChampFroid: Math.round(vocChampFroidCalc * 100) / 100,
                vmppChampChaud: Math.round(vmppChampChaud * 100) / 100,
                vmppNominal: Math.round(vmppNominal * 100) / 100,
                iscChamp: Math.round(iscChamp * 1000) / 1000,
                puissanceChampsWc
            },
            dimensionnement: {
                puissanceACMin,
                puissanceACRecommandee,
                puissanceACMax,
                ratioDCAC: Math.round(ratioDCAC * 1000) / 1000,
                evaluationRatio
            },
            verification: onduleurCandidat ? {
                compatible: erreurs.length === 0,
                details: verificationsCompatibilite!
            } : null,
            avertissements,
            erreurs
        };
    }
}

export const puissanceCretePVService = new PuissanceCretePVService();