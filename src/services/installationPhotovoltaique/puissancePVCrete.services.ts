import type {
  TypeInstallationPourPertes,
  PompageSolaireCaracteristiques,
  ParametresSTCPanneau,
  TemperaturesMinMax,
  TypeSystemePV,
  ParametresOnduleur,
  ContraintesOnduleurModules,
  ResultatModulesPV,
  ResultatOnduleur,
  ConfigurationTension,
  EvaluationRatioOnduleur,
} from "../../types/installationPhotovoltaique.types.js";
import {
  IRRADIANCE_NOCT,
  T_AMB_NOCT,
  IRRADIANCE_STC,
  FACTEUR_SECURITE_COURANT,
  T_STC,
  A_REF,
  T_REF,
  T_REF_Noct,
} from "../../utils/constantesPhysiques.utils.js";

/**
 * Calcule la température de cellule selon modèle NOCT (p.4-5 guide)
 * Formule: T_cell = T_amb + (NOCT - 20) × G / 800
 * Pour la temperature min, on suppose le matin, avec le froid de la nuit
 */
const temperatureCelluleMinMax = (
  tAmbient: TemperaturesMinMax,
  irradianceMax: number, //G
  noct: number // Temperature noct de la cellule)
): {
  Tmin: number;
  Tmax: number;
} => {
  const { temperatureMin: tAmbientMin, temperatureMax: tAmbientMax } = tAmbient;

  return {
    Tmin: tAmbientMin - 2,
    Tmax: tAmbientMax + ((noct - T_AMB_NOCT) * irradianceMax) / IRRADIANCE_NOCT,
  };
};

/**
 * Déterminer la tension minimisant les pertes P = RI² (J'en déduit que U = RI),
 * Si on augmente U, on diminue I pour la meme puissance,
 * mais il faut garder la praticité en tete
 * TODO: Je dois changer et pauffiner ceci après
 */
const tensionSystemePV = (
  puissanceCretePV: number
): { config: ConfigurationTension; tension: number } => {
  let tensionSystem: number = 24;
  let configuration: ConfigurationTension = "basse_tension";

  if (puissanceCretePV > 2000 && puissanceCretePV < 5000) {
    tensionSystem = 48;
    configuration = "basse_tension";
  }
  if (puissanceCretePV > 5000 && puissanceCretePV < 15000) {
    tensionSystem = 120;
    configuration = "basse_tension";
  }
  if (puissanceCretePV > 15000 && puissanceCretePV < 50000) {
    tensionSystem = 240;
    configuration = "basse_tension";
  }
  if (puissanceCretePV > 50000 && puissanceCretePV < 500000) {
    tensionSystem = 600;
    configuration = "haute_tension";
  }
  if (puissanceCretePV > 500000 && puissanceCretePV < 1000000) {
    tensionSystem = 1000;
    configuration = "haute_tension";
  }
  if (puissanceCretePV > 1000000) {
    tensionSystem = 1500;
    configuration = "haute_tension";
  }

  return {
    config: configuration,
    tension: tensionSystem,
  };
};
// WARNING:

/**
 * IDEA: En fonction du climat (chaud, froid, tempéré, ...) on a differentes priorités
 * En climat chaud, on va chercher à se rapprocher de N_panneaux_par_string_min
 * En climat froid, on va chercher à se rapprocher de N_panneaux_par_string_max
 *
 * Ce facteur nous permet de représenter le climat et de choisir N_panneaux_par_string EN FONCTION
 *
 * WARNING: C'est une petites lubie personnelle, et non un outils normalisé
 * WARNING: Mais c'est mon api, donc je fait ce que je veux
 */

const nombreParClimat = (
  temperaturesAttendue: TemperaturesMinMax,
  Nmin: number,
  Nmax: number
) => {
  const { temperatureMin: Tmin, temperatureMax: Tmax } = temperaturesAttendue;

  const temperature_moyenne: number = (Tmax + Tmin) / 2; // Tmoy
  const amplitude_thermique: number = Tmax - Tmin; // A
  const variable_climatique: number =
    (T_REF_Noct - temperature_moyenne) / (amplitude_thermique - T_REF_Noct); // X
  const sensibilite_climatique: number =
    1 +
    amplitude_thermique / A_REF +
    (Math.abs(Tmax - T_REF_Noct) + Math.abs(Tmin - T_REF_Noct)) / (2 * T_REF); // k

  const facteur_climatique: number =
    1 / (1 + Math.exp(-sensibilite_climatique * variable_climatique)); // Fclim = 1 / (1 + exp(-kX))

  return Nmin + facteur_climatique * (Nmax - Nmin);
};

/**
 * Service de dimensionnement de la puissance crête PV et des composants
 * Conforme IEC 61215 (modules), IEC 62109 (onduleurs), NF EN 50549 (injection)
 */
export class PuissanceCretePVService {
  /**
   * Détermination du ratio de performance
   * Il sera déterminer par rapport à la nature du systeme
   * C'est bien sur améliorable par la suite
   */
  performanceRatio(typeInstallation: TypeInstallationPourPertes | string): {
    pertesTotales: number;
    PR: number;
  } {
    // Pertes système selon qualité installation (p.4 guide)
    // Standard: 18-22% pertes → PR = 0.78-0.82
    let pertes_system: number =
      typeInstallation === "HAUTE_QUALITE"
        ? 10
        : typeInstallation === "POUSSIEREUX"
        ? 22
        : typeInstallation === "FAIBLE_MAINTENANCE" ||
          typeInstallation === "CABLE_LONG"
        ? 25
        : typeInstallation === "ANCIEN"
        ? 28
        : 18; // Standard = 18

    const performance_ratio = (100 - pertes_system) / 100;

    return {
      pertesTotales: pertes_system,
      PR: performance_ratio,
    };
  }

  /**
   * Calcule la puissance crête PV nécessaire
   *
   * Standard: Pc = E_charge / (PSH × PR)
   * Pompage: Pc = E_hydraulique / (PSH × η_onduleur × PR) (p.4-5 guide)
   */
  puissanceCretePV(
    pompageSolaire: boolean,
    energieCrete: number, // Wh/j (consommation ou énergie hydraulique)
    PSH: number, // h/j
    PR: number, // 0-1
    pompageCaracteristiques: PompageSolaireCaracteristiques | null | undefined,
    rendementOnduleurMTTP: number | null | undefined
  ): number {
    let Pc: number;

    if (pompageSolaire && pompageCaracteristiques) {
      // Dimensionnement pompage solaire, on prend la formule E_hydraulique = ρ × g × Q × H_man / (3600 × η_pompe)
      const {
        masseVolumique, // kg/metre cube
        accelerationPesanteur, // m/s²
        debit, // metre cube/j
        hauteurMano, // metre
        rendementPompe, // 0.4 - 0.7
      } = pompageCaracteristiques;

      const E_hydraulique =
        (masseVolumique * accelerationPesanteur * debit * hauteurMano) /
        (3600 * rendementPompe);

      const rendementOnduleur = rendementOnduleurMTTP ?? 0.98;

      // WARNING: CORRECTION PR en pompage direct sans batterie tampon
      // Les pertes sont plus élevées: démarrage/stop fréquent, rendement pompe variable.
      // Selon des guides techniques que j'avait consulté (j'ai oublié lesquels précisement), PR_pompage = PR × 0.90 (perte variabilité significative) au lieu de 0.95.
      const PR_pompage = PR * 0.9;
      Pc = E_hydraulique / (PSH * rendementOnduleur * PR_pompage);
    } else {
      // Dimensionnement standard (p.4 de mon guide)
      // Pc [en Wc] = E_charge [en Wh/j] / (PSH [en h] × PR)
      Pc = energieCrete / (PSH * PR);
    }

    return Math.ceil(Pc);
    // Arrondi supérieur pour sécurité
    // et aussi pas se faire chier avec trop de virgules ou autres
  }

  /**
   * Dimensionnement du champ de modules avec contraintes onduleur réelles
   * Basé sur NFC 15-100 §771 et IEC 62109
   *
   * Pour onduleurs modernes: utiliser plage MPPT (100-800V typique)
   * Pour systèmes batterie: utiliser tension système (12/24/48/96V)
   */
  modulesPV(
    panneauParametres: ParametresSTCPanneau,
    puissanceCretePV: number,
    temperaturesAttendue: TemperaturesMinMax,
    irradianceMax: number
  ): ResultatModulesPV {
    const {
      puissanceCreteModule,
      tensionMPP,
      tensionVoc,
      courantCourtCircuit,
      coeffTempTension,
      coeffTempPuissance,
      noct,
    } = panneauParametres;

    const noct_module = noct ?? 45;

    /**
     * Calcul températures de cellule
     * Condition froide: faible irradiance (aube/crépuscule) → Voc max
     * Condition chaude: irradiance max → Vmpp min, P min
     */
    const t_cell = temperatureCelluleMinMax(
      temperaturesAttendue,
      irradianceMax,
      noct_module
    );

    /**
     * Tensions corrigées en température
     * β en valeur absolue pour eviter les erreurs de signe
     * Et aussi en decimal pas pourcentage (ex: -0.35%/°C → 0.0035 /°C)
     */
    const pratiqueBeta = (0 - Math.abs(coeffTempTension)) / 100; // Forcer négatif pour tension on ne sait jamais ce que le front enverra, pas confiance
    const tension_panneau_max =
      tensionVoc * (1 + pratiqueBeta * (t_cell.Tmin - T_STC)); // voc_max
    const tension_panneau_min =
      tensionMPP * (1 + pratiqueBeta * (t_cell.Tmax - T_STC)); // vmpp_min

    // IDEA: Si on a besoin de voc minimal, ce serait : const voc_min = tensionVoc * (1 + pratiqueBeta * (t_cell.Tmax - T_STC));
    const vmpp_max = tensionMPP * (1 + pratiqueBeta * (t_cell.Tmin - T_STC));

    /**
     * Puissances corrigées en température
     * γ en valeur absolue pour eviter les erreurs de signe
     * Et aussi en decimal pas pourcentage (ex: -0.35%/°C → 0.0035 /°C)
     * WARNING: Ici c'est pas encore bien fait comme logique
     * WARNING: Je dois utiliser une logique basée sur les couples G et T_cell, nous le ferons après
     */
    const pratiqueGamma = (0 - Math.abs(coeffTempPuissance)) / 100;
    const puissance_panneau_max =
      puissanceCreteModule * (1 + pratiqueGamma * (t_cell.Tmin - T_STC));
    const puissance_panneau_min =
      puissanceCreteModule * (1 + pratiqueGamma * (t_cell.Tmax - T_STC));

    /**
     * Pour les courants; on sait que P = UI => I = P / U
     * En appliquant cette logique:
     * Imin = Pmin / Umax
     * Imax = Pmax / Umin
     */
    const courant_panneau_max: number =
      puissance_panneau_max / tension_panneau_min;
    const courant_panneau_min: number =
      puissance_panneau_min / tension_panneau_max;

    // Tension système pv
    const { config: configuration_system, tension: tension_DC_system_PV } =
      tensionSystemePV(puissanceCretePV);

    const N_panneaux_par_string_max: number = Math.ceil(
      tension_DC_system_PV / tension_panneau_min
    );
    const N_panneaux_par_string_min: number = Math.floor(
      tension_DC_system_PV / tension_panneau_max
    );

    const N_strings_en_parallele_max: number =
      puissanceCretePV / (N_panneaux_par_string_min * puissance_panneau_min);
    const N_strings_en_parallele_min: number =
      puissanceCretePV / (N_panneaux_par_string_max * puissance_panneau_max);

    const N_panneaux_par_string: number = nombreParClimat(
      temperaturesAttendue,
      N_panneaux_par_string_min,
      N_panneaux_par_string_max
    );
    const N_string_en_parallele: number = nombreParClimat(
      temperaturesAttendue,
      N_strings_en_parallele_min,
      N_strings_en_parallele_max
    );

    return {
      appareil: "panneaux photovoltaiques",
      configuration: configuration_system,
      panneauxParString: N_panneaux_par_string,
      stringsEnParallele: N_string_en_parallele,
      totalPanneaux: N_panneaux_par_string * N_string_en_parallele,
      tensionStringMin: N_panneaux_par_string * tension_panneau_min, // Vmpp à Tmax (condition chaude)
      tensionStringMax: N_panneaux_par_string * vmpp_max, // Vmpp à Tmin (condition froide)
      tensionStringSTC: N_panneaux_par_string * tensionMPP, // Vmpp à 25°C
      vocStringFroid: N_panneaux_par_string * tension_panneau_max, // Voc à Tmin (CRITIQUE sécurité)
      courantCourtCircuitPV: N_string_en_parallele * courantCourtCircuit,
      courantPVMin: N_string_en_parallele * courant_panneau_min,
      courantPVMax: N_string_en_parallele * courant_panneau_max,
      puissancePVInstallee: {
        stc:
          N_panneaux_par_string * N_string_en_parallele * puissanceCreteModule, // Puissance nominale à STC (pour ratio DC/AC)
        min:
          N_panneaux_par_string * N_string_en_parallele * puissance_panneau_min, // à Tmax
        max:
          N_panneaux_par_string * N_string_en_parallele * puissance_panneau_max, // à Tmin ensoleillement optimal
      },
      // Métadonnées internes
      _temperaturesCellule: {
        tCellMin: t_cell.Tmin,
        tCellMax: t_cell.Tmax,
      },
      _modules: {
        vmppModuleChaud: tension_panneau_min,
        vmppModuleFroid: vmpp_max,
        vocModuleFroid: tension_panneau_max,
      },
    };
  }

  /**
   * Vérification et dimensionnement onduleur
   * Ratio DC/AC cible: 1.15 (tropiques), limites [1.0-1.4] (p.6 guide)
   *
   * CORRECTIONS MAJEURES:
   * 1. Ratio DC/AC calculé avec puissance STC, pas puissance à froid
   * 2. Vérification Vmpp max avec tension froide (pas nominal)
   * 3. Courant avec facteur de sécurité IEC 62109
   * 4. Puissance DC max comparée à puissance STC
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
    irradianceMax: number,
    typeSysteme: TypeSystemePV,
    puissanceChargeContinue: number,
    onduleurCandidat?: ParametresOnduleur | null,
    puissanceDemarrage?: number | null
  ): ResultatOnduleur {
    const {
      tensionStringMin,
      tensionStringMax,
      tensionStringSTC,
      vocStringFroid,
      courantCourtCircuitPV,
      _temperaturesCellule,
      _modules,
      puissancePVInstallee,
    } = resultatsModules;

    // Recalcul ou réutilisation températures
    const { tCellMin, tCellMax } = _temperaturesCellule;

    // --- Grandeurs électriques du champ ---
    const vocChampFroidCalc = vocStringFroid;

    // Vmpp champ à chaud (risque décrochage MPPT)
    const vmppChampChaud = tensionStringMin;

    // Vmpp champ à froid (risque dépassement MPPT max)
    const vmppChampFroid = tensionStringMax;

    // Vmpp nominal (STC)
    const vmppNominal = tensionStringSTC;

    // Isc champ à irradiance max avec facteur de sécurité IEC 62109
    const facteurIrradiance = irradianceMax / IRRADIANCE_STC;
    const iscChampBrut = courantCourtCircuitPV * facteurIrradiance;
    const iscChamp = iscChampBrut * FACTEUR_SECURITE_COURANT; // Marge sécurité

    // CORRECTION: Puissance champ pour ratio DC/AC = puissance STC nominale
    // La puissance à froid est un pic transitoire, pas la puissance de dimensionnement
    const puissanceChampsWcSTC =
      puissancePVInstallee.stc ?? puissancePVInstallee.max;

    // Puissance max à froid (pour vérification puissance DC max)
    const puissanceChampsWcMax = puissancePVInstallee.max;

    // --- Dimensionnement recommandé ---
    // Ratio DC/AC selon ensoleillement (p.6 guide)
    // Fort ensoleillement (Afrique): 1.20-1.40
    // Modéré (Europe sud): 1.10-1.25
    // Faible (Europe nord): 1.00-1.15
    const ratioCible = 1.15; // Valeur standard
    const ratioMin = 1.0;
    const ratioMax = 1.4;

    const puissanceACMin = puissanceChampsWcSTC / ratioMax;
    const puissanceACRecommandee = puissanceChampsWcSTC / ratioCible;
    const puissanceACMax = puissanceChampsWcSTC / ratioMin;

    const ratioDCAC = onduleurCandidat
      ? puissanceChampsWcSTC / onduleurCandidat.puissanceACNominale
      : puissanceChampsWcSTC / puissanceACRecommandee;

    // Évaluation ratio
    let evaluationRatio: EvaluationRatioOnduleur =
      ratioDCAC < ratioMin
        ? "sous-dimensionne"
        : ratioDCAC <= 1.25
        ? "optimal"
        : ratioDCAC <= ratioMax
        ? "acceptable"
        : "eleve";

    // --- Vérifications compatibilité ---
    const avertissements: string[] = [];
    const erreurs: string[] = [];

    let verificationsCompatibilite:
      | Exclude<ResultatOnduleur["verification"], null>["details"]
      | null = null;

    if (onduleurCandidat) {
      // CORRECTION: Vérifications avec bonnes grandeurs

      // 1. Voc à froid < tension DC max (sécurité absolue)
      const vocOk = vocChampFroidCalc < onduleurCandidat.tensionDCMax;

      // 2. Vmpp à chaud > MPPT min (éviter décrochage)
      const vmppMinOk = vmppChampChaud > onduleurCandidat.tensionMPPTMin;

      // 3. CORRECTION: Vmpp à froid < MPPT max (éviter dépassement plage)
      // Pas vmppNominal! À froid, Vmpp est plus haute.
      const vmppMaxOk = vmppChampFroid < onduleurCandidat.tensionMPPTMax;
      const vmppPlageOk = vmppMinOk && vmppMaxOk;

      // 4. Isc avec facteur sécurité < courant DC max
      const iscOk = iscChamp <= onduleurCandidat.courantDCMax;

      // 5. CORRECTION: Puissance DC max comparée à puissance STC (pas max froid)
      // Si puissanceDCMax non spécifiée, utiliser puissanceAC * 1.1 (convention moderne)
      const puissanceDCMaxOnduleur =
        onduleurCandidat.puissanceDCMax ??
        onduleurCandidat.puissanceACNominale * 1.1;
      const pdcOk = puissanceChampsWcSTC <= puissanceDCMaxOnduleur;

      // 6. Puissance AC nominale >= charge continue
      const chargeOk =
        onduleurCandidat.puissanceACNominale >= puissanceChargeContinue;

      // 7. Capacité surcharge pour démarrage moteurs
      const puissanceSurcharge =
        onduleurCandidat.puissanceSurcharge ??
        onduleurCandidat.puissanceACNominale * 1.5;
      const surchargeOk =
        puissanceDemarrage != null
          ? puissanceSurcharge >= puissanceDemarrage
          : null;

      verificationsCompatibilite = {
        vocSousLimite: vocOk,
        vmppAuDessusMinimum: vmppMinOk,
        vmppDansPlageMPPT: vmppPlageOk,
        iscSousLimite: iscOk,
        puissanceDCOk: pdcOk,
        chargeACOk: chargeOk,
        surchargeOk,
      };

      // Messages d'erreur/avertissement
      if (!vocOk) {
        erreurs.push(
          `CRITIQUE: Voc champ à froid (${vocChampFroidCalc.toFixed(1)} V) ≥ ` +
            `tensionDCMax onduleur (${onduleurCandidat.tensionDCMax} V) - RISQUE DESTRUCTION. ` +
            `Ns doit être ≤ ${Math.floor(
              onduleurCandidat.tensionDCMax / _modules.vocModuleFroid
            )}.`
        );
      }
      if (!vmppMinOk) {
        avertissements.push(
          `Vmpp champ à chaud (${vmppChampChaud.toFixed(1)} V) < ` +
            `tensionMPPTMin (${onduleurCandidat.tensionMPPTMin} V) - Risque décrochage MPPT hiver. ` +
            `Ns doit être ≥ ${Math.ceil(
              onduleurCandidat.tensionMPPTMin / _modules.vmppModuleChaud
            )}.`
        );
      }
      if (!vmppMaxOk) {
        erreurs.push(
          `Vmpp champ à froid (${vmppChampFroid.toFixed(1)} V) > ` +
            `tensionMPPTMax (${onduleurCandidat.tensionMPPTMax} V) - MPPT hors plage hiver. ` +
            `Ns doit être ≤ ${Math.floor(
              onduleurCandidat.tensionMPPTMax / _modules.vmppModuleFroid
            )}.`
        );
      }
      if (!iscOk) {
        erreurs.push(
          `Isc champ avec marge sécurité (${iscChamp.toFixed(
            2
          )} A) > courantDCMax ` +
            `(${onduleurCandidat.courantDCMax} A) - Surcharge entrée DC. ` +
            `Np max = ${Math.floor(
              onduleurCandidat.courantDCMax /
                (panneauParametres.courantCourtCircuit *
                  facteurIrradiance *
                  FACTEUR_SECURITE_COURANT)
            )}.`
        );
      }
      if (!pdcOk) {
        avertissements.push(
          `Puissance PV STC (${puissanceChampsWcSTC} W) > puissanceDCMax onduleur ` +
            `(${puissanceDCMaxOnduleur} W) - Clipping ou surcharge DC possible.`
        );
      }
      if (!chargeOk) {
        erreurs.push(
          `Puissance AC onduleur (${onduleurCandidat.puissanceACNominale} W) < ` +
            `charge continue (${puissanceChargeContinue} W) - Sous-dimensionnement AC.`
        );
      }
      if (surchargeOk === false) {
        avertissements.push(
          `Capacité surcharge (${puissanceSurcharge} W) < démarrage requis (${puissanceDemarrage} W) - ` +
            `Risque blocage démarrage moteur.`
        );
      }
    }

    return {
      appareil: "onduleur",
      typeSysteme,
      rappelVocStringFroid: vocStringFroid || null,
      grandeursChamp: {
        tCellMin: Math.round(tCellMin * 10) / 10,
        tCellMax: Math.round(tCellMax * 10) / 10,
        vocChampFroid: Math.round(vocChampFroidCalc * 100) / 100,
        vmppChampChaud: Math.round(vmppChampChaud * 100) / 100,
        vmppChampFroid: Math.round(vmppChampFroid * 100) / 100, // AJOUT
        vmppNominal: Math.round(vmppNominal * 100) / 100,
        iscChamp: Math.round(iscChamp * 1000) / 1000,
        puissanceChampsWcSTC, // AJOUT: puissance STC
        puissanceChampsWcMax, // AJOUT: puissance max froid
      },
      dimensionnement: {
        puissanceACMin,
        puissanceACRecommandee,
        puissanceACMax,
        ratioDCAC: Math.round(ratioDCAC * 1000) / 1000,
        evaluationRatio,
      },
      verification: onduleurCandidat
        ? {
            compatible: erreurs.length === 0,
            details: verificationsCompatibilite!,
          }
        : null,
      avertissements,
      erreurs,
    };
  }
}

export const puissanceCretePVService = new PuissanceCretePVService();
