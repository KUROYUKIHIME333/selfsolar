import type {
  TypeInstallationPourPertes,
  PompageSolaireCaracteristiques,
  ParametresSTCPanneau,
  TemperaturesMinMax,
  TypeSystemePV,
  ParametresOnduleur,
  ResultatModulesPV,
  ResultatOnduleur,
  ConfigurationTension,
  EvaluationRatioOnduleur,
} from "../../types/installationPhotovoltaique.types.js";
import { TypeInstallationPourPertesArray } from "../../types/installationPhotovoltaique.types.js";
import {
  IRRADIANCE_STC,
  FACTEUR_SECURITE_COURANT,
  T_STC,
} from "../../utils/constantesPhysiques.utils.js";
import { tensionSystemePV } from "../../utils/tensionSystemePV.utils.js";
import {
  temperatureCelluleMinMax,
  nombreParClimat,
} from "../../utils/impactClimatSurModules.utils.js";
import { sendResponse } from "../../utils/handlers.utils.js";

/**
 * Service de dimensionnement de la puissance crête PV et des composants
 * Conforme IEC 61215 (modules), IEC 62109 (onduleurs), NF EN 50549 (injection)
 */
export class PuissanceCretePVService {
  /**
   * Détermination du Performance Ratio (PR) et des pertes globales du système.
   * Le PR exprime la part d'énergie réellement disponible à la sortie du système
   * par rapport à l'énergie théorique produite par les panneaux.
   */
  performanceRatio(typeInstallation: TypeInstallationPourPertes): {
    success: boolean;
    error: string | null;
    data : {pertesTotales: number; // En pourcentage (%)
    PR: number; // Facteur compris entre 0 et 1
    } | null;
    
  } {
    if (!typeInstallation || !TypeInstallationPourPertesArray.includes(typeInstallation)) {
      return sendResponse(false, "Type d'installation non pris en charge", null)
    }
    // Dictionnaire des pertes par défaut selon la configuration terrain
    const tablePertes: Record<TypeInstallationPourPertes, number> = {
      HAUTE_QUALITE: 10, // Conditions labo, nettoyage fréquent, câblage optimisé
      STANDARD: 18, // Configuration résidentielle classique bien exécutée
      POUSSIEREUX: 22, // Zones à forte sédimentation/poussière sans nettoyage régulier
      FAIBLE_MAINTENANCE: 25, // Pas de suivi, dégradation non surveillée
      CABLE_LONG: 25, // Grosses pertes en ligne DC ou AC dues à la distance
      ANCIEN: 28, // Vieillissement prématuré des composants / dégradation induite
    };


    const responseDatas = {
      pertesTotales: tablePertes[typeInstallation] ?? tablePertes.STANDARD,
      PR: Number(((100 - (tablePertes[typeInstallation] ?? tablePertes.STANDARD)) / 100).toFixed(2)), 
    }

    return sendResponse(true, null, responseDatas)
  }

  /**
   * Calcule la puissance crête PV nécessaire
   *
   * Standard: Pc = E_charge / (PSH × PR)
   * Pompage: Pc = E_hydraulique / (PSH × η_onduleur × PR) (p.4-5 guide)
   */
  puissanceCretePV(
    pompageSolaire: boolean,
    energieCrete: number | undefined, // Wh/j (Ignoré si pompageSolaire = true)
    PSH: number, // h/j (Heures d'ensoleillement équivalentes à 1000W/m²)
    PR: number, // Facteur 0 à 1 (Performance Ratio)
    pompageCaracteristiques?: PompageSolaireCaracteristiques | undefined,
    rendementOnduleurMTTP?: number | undefined
  ): {
    success: boolean;
    error: string | null;
    data: { puissanceCrete: number } | null;
  } {
    // Validations des variables communes fondamentales pour eviter les divisions par zéro
    const defaultPuissanceCrete = {
      puissanceCrete: 0,
    };
    if (typeof PSH !== "number" || isNaN(PSH) || PSH <= 0) {
      return sendResponse(
        false,
        "Le PSH (Peak Sun Hours) doit être un nombre strictement supérieur à 0.",
        defaultPuissanceCrete
      );
    }
    if (typeof PR !== "number" || isNaN(PR) || PR <= 0 || PR > 1) {
      return sendResponse(
        false,
        "Le Performance Ratio (PR) doit être compris strictement entre 0 et 1.",
        defaultPuissanceCrete
      );
    }

    let Pc: number;

    // Pompage Solaire Direct
    if (pompageSolaire && !energieCrete) {
      if (!pompageCaracteristiques) {
        return sendResponse(
          false,
          "Les caractéristiques hydrauliques de pompage sont obligatoires lorsque le mode pompage est activé.",
          defaultPuissanceCrete
        );
      }

      const {
        masseVolumique,
        accelerationPesanteur,
        debit,
        hauteurMano,
        rendementPompe,
      } = pompageCaracteristiques;

      // Validation des données hydrauliques
      if (
        [
          masseVolumique,
          accelerationPesanteur,
          debit,
          hauteurMano,
          rendementPompe,
        ].some((val) => typeof val !== "number" || isNaN(val) || val <= 0)
      ) {
        return sendResponse(
          false,
          "Toutes les caractéristiques de pompage doivent être des nombres valides et supérieurs à 0.",
          defaultPuissanceCrete
        );
      }

      if (rendementPompe > 1 || rendementPompe < 0) {
        return sendResponse(
          false,
          "Le rendement de la pompe ne peut pas être entre 0 et 1. ",
          defaultPuissanceCrete
        );
      }

      // Calcul de l'énergie hydraulique requise par jour (en Wh/j)
      // Formule : (rho * g * Q * HMT) / (3600 * rendement_pompe)
      const E_hydraulique =
        (masseVolumique * accelerationPesanteur * debit * hauteurMano) /
        (3600 * rendementPompe);

      // Détermination du rendement de l'onduleur/variateur de pompage
      const rendementOnduleur = rendementOnduleurMTTP ?? 0.98;
      if (rendementOnduleur <= 0 || rendementOnduleur > 1) {
        return sendResponse(
          false,
          "Le rendement de l'onduleur doit être compris entre 0 et 1.",
          defaultPuissanceCrete
        );
      }

      // Ajustement empirique du PR : Pertes d'intermittence et couplage direct (-10%)
      const PR_pompage = PR * 0.9;

      // Application de la formule finale pour le pompage
      Pc = E_hydraulique / (PSH * rendementOnduleur * PR_pompage);
    } else {
      // Dimensionnement Standard (Résidentiel / Tertiaire classique)
      if (
        typeof energieCrete !== "number" ||
        isNaN(energieCrete) ||
        energieCrete <= 0
      ) {
        return sendResponse(
          false,
          "L'énergie de charge (Wh/j) doit être un nombre strictement supérieur à 0.",
          defaultPuissanceCrete
        );
      }

      // Formule classique : Pc = E_charge / (PSH * PR)
      Pc = energieCrete / (PSH * PR);
    }

    // Retour propre avec arrondi de sécurité supérieur
    const returnDatas = {
      puissanceCrete: Math.ceil(Pc),
    };
    return sendResponse(true, null, returnDatas);
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
    irradianceMax: number,
    tensionSystem?: number,
    configurationSystem?: ConfigurationTension
  ): { success: boolean;  error: string | null; data: ResultatModulesPV | null } {
    if (
      !panneauParametres ||
      typeof puissanceCretePV !== "number" ||
      puissanceCretePV <= 0 ||
      isNaN(puissanceCretePV)
    ) {
      return sendResponse(false, "Paramètres de panneaux ou puissance crête cible invalides.", null)
    }

    const {
      puissanceCreteModule,
      tensionMPP,
      tensionVoc,
      //courantMPP,
      courantCourtCircuit,
      coeffTempTension,
      coeffTempPuissance,
      //coeffTempCourant,
      noct,
    } = panneauParametres;

    // Validation de sécurité sur le panneau pour éviter des divisions par 0 en désordre
    if (
      [puissanceCreteModule, tensionMPP, tensionVoc, courantCourtCircuit].some(
        (val) => typeof val !== "number" || val <= 0 || isNaN(val)
      )
    ) {
      return sendResponse(false, "Les caractéristiques électriques STC du panneau doivent être des nombres strictement positifs.",null);
    }

    const noct_module = noct ?? 45;

    let t_cell;
    try {
      t_cell = temperatureCelluleMinMax(
        temperaturesAttendue,
        irradianceMax,
        noct_module
      );
    } catch (err: any) {
      return sendResponse(false, `Erreur calcul température cellule : ${err.message}`, null);
    }

    // Normalisation et sécurisation des coefficients thermiques
    // Eviter les erreurs de signe du Front (on n a pas confiance)
    const pratiqueBeta = (0 - Math.abs(coeffTempTension)) / 100;
    const pratiqueGamma = (0 - Math.abs(coeffTempPuissance)) / 100;

    // Tensions corrigées en température
    const tension_panneau_max =
      tensionVoc * (1 + pratiqueBeta * (t_cell.Tmin - T_STC)); // Voc max (à froid)
    const tension_panneau_min =
      tensionMPP * (1 + pratiqueBeta * (t_cell.Tmax - T_STC)); // Vmpp min (à chaud)
    const vmpp_max = tensionMPP * (1 + pratiqueBeta * (t_cell.Tmin - T_STC)); // Vmpp max (à froid)

    if (tension_panneau_min <= 0 || tension_panneau_max <= 0) {
      return sendResponse(false, "Les tensions corrigées du panneau sont aberrantes (inférieures ou égales à 0V). Vérifiez les températures.", null);
    }

    // Puissances corrigées en température
    const puissance_panneau_max =
      puissanceCreteModule * (1 + pratiqueGamma * (t_cell.Tmin - T_STC));
    const puissance_panneau_min =
      puissanceCreteModule * (1 + pratiqueGamma * (t_cell.Tmax - T_STC));

    // Courants induits (I = P / U)
    const courant_panneau_max = puissance_panneau_max / tension_panneau_min;
    const courant_panneau_min = puissance_panneau_min / tension_panneau_max;

    // tension DC cible du système
    let tension_DC_system_PV: number;
    let configuration_system: ConfigurationTension;

    if (tensionSystem && configurationSystem) {
      tension_DC_system_PV = tensionSystem;
      configuration_system = configurationSystem;
    } else {
      const resTension = tensionSystemePV(puissanceCretePV);
      if (!resTension.success) {
        return sendResponse(false, `Calcul tension système échoué : ${resTension.error}`, null);
      }
      tension_DC_system_PV = resTension.tension;
      configuration_system = resTension.config;
    }

    // Nombre max de panneaux (limité par la tension min du panneau à chaud pour atteindre la tension système)
    let N_panneaux_par_string_max = Math.floor(
      tension_DC_system_PV / tension_panneau_min
    );
    // Nombre min de panneaux (limité par la tension max du panneau à froid pour ne pas dépasser la tension système)
    let N_panneaux_par_string_min = Math.ceil(
      tension_DC_system_PV / tension_panneau_max
    );

    // Garde-fou : si la plage est inversée ou écrasée par les arrondis, on synchronise
    if (N_panneaux_par_string_min > N_panneaux_par_string_max) {
      N_panneaux_par_string_min = N_panneaux_par_string_max;
    }
    if (N_panneaux_par_string_min < 1) N_panneaux_par_string_min = 1;
    if (N_panneaux_par_string_max < 1) N_panneaux_par_string_max = 1;

    // Nombre de chaînes en parallèle
    const N_strings_en_parallele_max =
      puissanceCretePV / (N_panneaux_par_string_min * puissance_panneau_min);
    const N_strings_en_parallele_min =
      puissanceCretePV / (N_panneaux_par_string_max * puissance_panneau_max);

    const resClimatString = nombreParClimat(
      temperaturesAttendue,
      N_panneaux_par_string_min,
      N_panneaux_par_string_max
    );
    const resClimatPara = nombreParClimat(
      temperaturesAttendue,
      N_strings_en_parallele_min,
      N_strings_en_parallele_max
    );

    if (!resClimatString.success || !resClimatPara.success) {
      return sendResponse(false, `Erreur dans la répartition climatique : ${
          resClimatString.error || resClimatPara.error
        }`, null);
    }

    const N_panneaux_par_string = resClimatString.nombrePanneaux;
    const N_string_en_parallele = resClimatPara.nombrePanneaux || 1; // Sécurité : au moins 1 string en parallèle

    // Formatage du résultat final propre
    const responseDatas = {
        appareil: "panneaux photovoltaiques",
        configuration: configuration_system,
        panneauxParString: N_panneaux_par_string,
        stringsEnParallele: N_string_en_parallele,
        totalPanneaux: N_panneaux_par_string * N_string_en_parallele,
        tensionStringMin: Number(
          (N_panneaux_par_string * tension_panneau_min).toFixed(2)
        ),
        tensionStringMax: Number((N_panneaux_par_string * vmpp_max).toFixed(2)),
        tensionStringSTC: Number(
          (N_panneaux_par_string * tensionMPP).toFixed(2)
        ),
        vocStringFroid: Number(
          (N_panneaux_par_string * tension_panneau_max).toFixed(2)
        ),
        courantCourtCircuitPV: Number(
          (N_string_en_parallele * courantCourtCircuit).toFixed(2)
        ),
        courantPVMin: Number(
          (N_string_en_parallele * courant_panneau_min).toFixed(2)
        ),
        courantPVMax: Number(
          (N_string_en_parallele * courant_panneau_max).toFixed(2)
        ),
        puissancePVInstallee: {
          stc: Number(
            (
              N_panneaux_par_string *
              N_string_en_parallele *
              puissanceCreteModule
            ).toFixed(2)
          ),
          min: Number(
            (
              N_panneaux_par_string *
              N_string_en_parallele *
              puissance_panneau_min
            ).toFixed(2)
          ),
          max: Number(
            (
              N_panneaux_par_string *
              N_string_en_parallele *
              puissance_panneau_max
            ).toFixed(2)
          ),
        },
        _temperaturesCellule: {
          tCellMin: t_cell.Tmin,
          tCellMax: t_cell.Tmax,
        },
        _modules: {
          vmppModuleChaud: Number(tension_panneau_min.toFixed(2)),
          vmppModuleFroid: Number(vmpp_max.toFixed(2)),
          vocModuleFroid: Number(tension_panneau_max.toFixed(2)),
        },
      };
    return sendResponse(true, null, responseDatas);
  }

  /**
   * Vérification de compatibilité et dimensionnement de l'onduleur.
   * Applique les ratios DC/AC cibles et les exigences de la norme IEC 62109.
   *
   * CORRECTIONS MAJEURES:
   * 1. Ratio DC/AC calculé avec puissance STC, pas puissance à froid
   * 2. Vérification Vmpp max avec tension froide (pas nominal)
   * 3. Courant avec facteur de sécurité IEC 62109
   * 4. Puissance DC max comparée à puissance STC
   *
   */
  onduleur(
    resultatsModules: ResultatModulesPV,
    panneauParametres: ParametresSTCPanneau,
    irradianceMax: number,
    typeSysteme: TypeSystemePV,
    puissanceChargeContinue: number,
    onduleurCandidat?: ParametresOnduleur | null,
    puissanceDemarrage?: number | null
  ): { success: boolean; error: string | null ; data: ResultatOnduleur | null} {
    if (!resultatsModules || !panneauParametres) {
      return sendResponse(false, "Les résultats des modules et les paramètres des panneaux sont requis.", null);
    }

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

    if (!_temperaturesCellule || !_modules || !puissancePVInstallee) {
      return sendResponse(false, "Données de structure internes du champ PV manquantes ou invalides.", null);
    }

    const { tCellMin, tCellMax } = _temperaturesCellule;

    // Grandeurs électriques du champ PV
    const vocChampFroidCalc = vocStringFroid;
    const vmppChampChaud = tensionStringMin;
    const vmppChampFroid = tensionStringMax;
    const vmppNominal = tensionStringSTC;

    // Prise en compte de l'irradiance locale réelle + Marge IEC 62109
    const irrMaxSafe =
      typeof irradianceMax !== "number" || irradianceMax <= 0
        ? IRRADIANCE_STC
        : irradianceMax;
    const facteurIrradiance = irrMaxSafe / IRRADIANCE_STC;
    const iscChampBrut = courantCourtCircuitPV * facteurIrradiance;
    const iscChamp = iscChampBrut * FACTEUR_SECURITE_COURANT;

    // Puissances de référence
    const puissanceChampsWcSTC =
      puissancePVInstallee.stc ?? puissancePVInstallee.max;
    const puissanceChampsWcMax = puissancePVInstallee.max;

    // Validation des puissances calculées pour éviter les divisions par zéro
    if (puissanceChampsWcSTC <= 0) {
      return sendResponse(false, "La puissance crête installée calculée (STC) doit être strictement supérieure à 0.", null);
    }

    // Bornes de dimensionnement théorique
    const ratioCible = 1.15;
    const ratioMin = 1.0;
    const ratioMax = 1.4;

    const puissanceACMin = puissanceChampsWcSTC / ratioMax;
    const puissanceACRecommandee = puissanceChampsWcSTC / ratioCible;
    const puissanceACMax = puissanceChampsWcSTC / ratioMin;

    // Verification onduleur candidat
    let ratioDCAC = ratioCible;
    let evaluationRatio: EvaluationRatioOnduleur = "optimal";

    const avertissements: string[] = [];
    const erreurs: string[] = [];
    let verificationsCompatibilite = null;

    // Déclenchement de la vérification seulement si l'onduleur a des specs valides
    if (onduleurCandidat && onduleurCandidat.puissanceACNominale > 0) {
      ratioDCAC = puissanceChampsWcSTC / onduleurCandidat.puissanceACNominale;

      if (ratioDCAC < ratioMin) evaluationRatio = "sous-dimensionne";
      else if (ratioDCAC >= 1 && ratioDCAC <= 1.25) evaluationRatio = "optimal";
      else if (ratioDCAC <= ratioMax) evaluationRatio = "acceptable";
      else evaluationRatio = "eleve";

      // Protection absolue contre les surtensions (Voc à froid)
      const vocOk =
        onduleurCandidat.tensionDCMax > 0 &&
        vocChampFroidCalc < onduleurCandidat.tensionDCMax;

      // Plage MPPT basse (à chaud)
      const vmppMinOk =
        onduleurCandidat.tensionMPPTMin > 0 &&
        vmppChampChaud > onduleurCandidat.tensionMPPTMin;

      // Plage MPPT haute (à froid)
      const vmppMaxOk =
        onduleurCandidat.tensionMPPTMax > 0 &&
        vmppChampFroid < onduleurCandidat.tensionMPPTMax;
      const vmppPlageOk = vmppMinOk && vmppMaxOk;

      // Imax admissible (IEC 62109)
      const iscOk =
        onduleurCandidat.courantDCMax > 0 &&
        iscChamp <= onduleurCandidat.courantDCMax;

      // Écrêtage ou surcharge DC
      const puissanceDCMaxOnduleur =
        onduleurCandidat.puissanceDCMax && onduleurCandidat.puissanceDCMax > 0
          ? onduleurCandidat.puissanceDCMax
          : onduleurCandidat.puissanceACNominale * 1.1;
      const pdcOk = puissanceChampsWcSTC <= puissanceDCMaxOnduleur;

      // Capacité à couvrir le talon de charge AC AC
      const chargeOk =
        onduleurCandidat.puissanceACNominale >= puissanceChargeContinue;

      // Courant d'appel moteurs (Surcharge transitoire)
      const puissanceSurcharge =
        onduleurCandidat.puissanceSurcharge &&
        onduleurCandidat.puissanceSurcharge > 0
          ? onduleurCandidat.puissanceSurcharge
          : onduleurCandidat.puissanceACNominale * 1.5;

      const surchargeOk =
        puissanceDemarrage && puissanceDemarrage > 0
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

      // Rapports d'erreurs pour ingénieur
      if (!vocOk) {
        const maxModulesVoc =
          _modules.vocModuleFroid > 0
            ? Math.floor(
                onduleurCandidat.tensionDCMax / _modules.vocModuleFroid
              )
            : 0;
        erreurs.push(
          `CRITIQUE: Voc champ à froid (${vocChampFroidCalc.toFixed(
            1
          )} V) ≥ tensionDCMax onduleur (${
            onduleurCandidat.tensionDCMax
          } V). ` +
            `Risque de destruction du matériel. Réduire à maximum ${maxModulesVoc} modules par string.`
        );
      }

      if (!vmppMinOk) {
        const minModulesVmpp =
          _modules.vmppModuleChaud > 0
            ? Math.ceil(
                onduleurCandidat.tensionMPPTMin / _modules.vmppModuleChaud
              )
            : 1;
        avertissements.push(
          `Attention: Vmpp champ à chaud (${vmppChampChaud.toFixed(
            1
          )} V) < tensionMPPTMin (${onduleurCandidat.tensionMPPTMin} V). ` +
            `Risque de perte de production par décrochage MPPT lors des fortes chaleurs. Augmenter à minimum ${minModulesVmpp} modules par string.`
        );
      }

      if (!vmppMaxOk) {
        const maxModulesVmpp =
          _modules.vmppModuleFroid > 0
            ? Math.floor(
                onduleurCandidat.tensionMPPTMax / _modules.vmppModuleFroid
              )
            : 0;
        erreurs.push(
          `Erreur: Vmpp champ à froid (${vmppChampFroid.toFixed(
            1
          )} V) > tensionMPPTMax (${onduleurCandidat.tensionMPPTMax} V). ` +
            `Le régulateur sera hors plage de tracking par temps froid. Limiter à ${maxModulesVmpp} modules par string.`
        );
      }

      if (!iscOk) {
        const denominateur =
          panneauParametres.courantCourtCircuit *
          facteurIrradiance *
          FACTEUR_SECURITE_COURANT;
        const maxStrings =
          denominateur > 0
            ? Math.floor(onduleurCandidat.courantDCMax / denominateur)
            : 1;
        erreurs.push(
          `CRITIQUE: Courant Isc corrigé (${iscChamp.toFixed(
            2
          )} A) > courantDCMax onduleur (${
            onduleurCandidat.courantDCMax
          } A). ` +
            `Risque de surchauffe de l'étage DC. Limiter à maximum ${maxStrings} strings en parallèle.`
        );
      }

      if (!pdcOk) {
        avertissements.push(
          `Note: Puissance PV STC (${puissanceChampsWcSTC} W) > puissanceDCMax autorisée (${puissanceDCMaxOnduleur} W). ` +
            `Un phénomène d'écrêtage (clipping) limitera la production aux heures de pointe.`
        );
      }

      if (!chargeOk) {
        erreurs.push(
          `Erreur: Puissance AC nominale (${onduleurCandidat.puissanceACNominale} W) insuffisante pour couvrir la charge continue (${puissanceChargeContinue} W).`
        );
      }

      if (surchargeOk === false) {
        avertissements.push(
          `Attention: La capacité de surcharge transitoire (${puissanceSurcharge} W) is inférieure à la puissance de pointe demandée au démarrage (${puissanceDemarrage} W). ` +
            `Risque de mise en sécurité de l'onduleur au démarrage des moteurs.`
        );
      }
    }

    const responseDatas = {
        appareil: "onduleur",
        typeSysteme,
        rappelVocStringFroid: vocStringFroid || null,
        grandeursChamp: {
          tCellMin: Math.round(tCellMin * 10) / 10,
          tCellMax: Math.round(tCellMax * 10) / 10,
          vocChampFroid: Math.round(vocChampFroidCalc * 100) / 100,
          vmppChampChaud: Math.round(vmppChampChaud * 100) / 100,
          vmppChampFroid: Math.round(vmppChampFroid * 100) / 100,
          vmppNominal: Math.round(vmppNominal * 100) / 100,
          iscChamp: Math.round(iscChamp * 1000) / 1000,
          puissanceChampsWcSTC: Math.round(puissanceChampsWcSTC),
          puissanceChampsWcMax: Math.round(puissanceChampsWcMax),
        },
        dimensionnement: {
          puissanceACMin: Math.round(puissanceACMin),
          puissanceACRecommandee: Math.round(puissanceACRecommandee),
          puissanceACMax: Math.round(puissanceACMax),
          ratioDCAC: Math.round(ratioDCAC * 1000) / 1000,
          evaluationRatio,
        },
        verification:
          onduleurCandidat && onduleurCandidat.puissanceACNominale > 0
            ? {
                compatible: erreurs.length === 0,
                details: verificationsCompatibilite!,
              }
            : null,
        avertissements,
        erreurs,
      };
    return sendResponse(true, null, responseDatas);
  }
}

export const puissanceCretePVService = new PuissanceCretePVService();
