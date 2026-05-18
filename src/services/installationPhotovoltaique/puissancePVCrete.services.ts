import type {
  TypeInstallationPourPertes,
  Localisation,
  TypeClimat,
  PompageSolaireCaracteristiques,
  ParametresSTCPanneau,
  TemperaturesMinMax,
  TypeSystemePV,
  ParametresOnduleur,
  ContraintesOnduleurModules,
  ResultatModulesPV,
  ResultatOnduleur,
} from "../../types/installationPhotovoltaique.types.js";
import {
  IRRADIANCE_NOCT,
  T_AMB_NOCT,
  IRRADIANCE_STC,
  FACTEUR_SECURITE_COURANT,
  T_STC,
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
//WARNING:
const tensionSystemePV = (puissanceCretePV: number): number => {
  let tensionSystem: number = 2;

  if (puissanceCretePV > 2000 && puissanceCretePV < 5000) {
    tensionSystem = 48;
  }
  if (puissanceCretePV > 5000 && puissanceCretePV < 15000) {
    tensionSystem = 120;
  }
  if (puissanceCretePV > 15000 && puissanceCretePV < 50000) {
    tensionSystem = 240;
  }
  if (puissanceCretePV > 50000 && puissanceCretePV < 500000) {
    tensionSystem = 600;
  }
  if (puissanceCretePV > 500000 && puissanceCretePV < 1000000) {
    tensionSystem = 1000;
  }
  if (puissanceCretePV > 1000000) {
    tensionSystem = 1500;
  }

  return tensionSystem;
};
//WARNING:



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
    let pertes_system: number = 18; // Standard

    switch (typeInstallation) {
      case "HAUTE_QUALITE":
        pertes_system = 10;
        break; // PR ~0.90
      case "POUSSIEREUX":
        pertes_system = 22;
        break; // PR ~0.78
      case "FAIBLE_MAINTENANCE":
        pertes_system = 25;
        break; // PR ~0.75
      case "ANCIEN":
        pertes_system = 28;
        break; // PR ~0.72
      case "CABLE_LONG":
        pertes_system = 25;
        break; // PR ~0.75
    }

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
    typeClimat: TypeClimat,
    panneauParametres: ParametresSTCPanneau,
    puissanceCretePV: number,
    temperaturesAttendue: TemperaturesMinMax,
    irradianceMin: number,
    irradianceMax: number,
    tensionSystemeBatterie: number | null | undefined,
    contraintesOnduleur?: ContraintesOnduleurModules | null,
  ): ResultatModulesPV {
    const {
      puissanceCreteModule,
      tensionMPP,
      tensionVoc,
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
      tensionVoc * (1 + pratiqueBeta * (t_cell.Tmin - T_STC));
    const tension_panneau_min =
      tensionMPP * (1 + pratiqueBeta * (t_cell.Tmax - T_STC));

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

    // Tension système pv
    const tension_DC_system_PV = tensionSystemePV(puissanceCretePV);

    let N_panneaux_par_string: number;

    const N_panneaux_par_string_max: number = Math.ceil(tension_DC_system_PV / tension_panneau_min);
    const N_panneaux_par_string_min: number = Math.floor(tension_DC_system_PV / tension_panneau_max);

    if (typeClimat === "chaud") {
      N_panneaux_par_string = tension_DC_system_PV / tensionMPP;
    }

    if (typeClimat === "froid") {
      
    }



    // Détermination Ns (modules en série)
    
    // let Ns_min: number;
    // let Ns_max: number;
    // let configuration: "haute_tension" | "basse_tension";

    // if (contraintesOnduleur) {
    //   // CAS ON-GRID / HYBRIDE / ONDULEUR MPPT HAUTE TENSION

    //   // Étape 1: Ns max limité par plage MPPT à froid (Vmpp haute)
    //   // Ns ne doit pas dépasser V_MPPT_max / Vmpp_froid
    //   const Ns_max_mppt = Math.floor(
    //     contraintesOnduleur.tensionMPPTMax / tension_mpp_max
    //   );

    //   // Étape 2: Ns max limité par sécurité Voc absolue à froid
    //   // C'est la contrainte absolue de sécurité IEC 62109
    //   const Ns_max_voc = Math.floor(
    //     contraintesOnduleur.tensionDCMax / voc_module_froid
    //   );

    //   // Étape 3: Ns_max est le MINIMUM des deux contraintes
    //   Ns_max = Math.min(Ns_max_mppt, Ns_max_voc);

    //   // Étape 4: Ns min pour atteindre V_MPPT_min à chaud (Vmpp basse)
    //   Ns_min = Math.ceil(contraintesOnduleur.tensionMPPTMin / tension_mpp_min);

    //   configuration = "haute_tension";
    // } else {
    //   // CAS OFF-GRID BASSE TENSION (PWM ou MPPT 12/24/48V)
    //   // CORRECTION: tensionSystemeBatterie doit être fourni pour ce cas
    //   if (!tensionSystemeBatterie) {
    //     throw new Error(
    //       "Dimensionnement off-grid: tensionSystemeBatterie est requise " +
    //         "quand aucune contrainte onduleur n'est fournie."
    //     );
    //   }

    //   // Tension de charge batterie: 14.4V (12V), 28.8V (24V), 57.6V (48V)
    //   const tensionChargeMax = tensionSystemeBatterie * 1.25; // Marge régulateur
    //   const tensionChargeMin = tensionSystemeBatterie * 0.85; // Décharge profonde

    //   Ns_max = Math.floor(tensionChargeMax / tension_mpp_max);
    //   Ns_min = Math.ceil(tensionChargeMin / tension_mpp_min);
    //   configuration = "basse_tension";
    // }

    // // Vérification faisabilité
    // if (Ns_min > Ns_max) {
    //   throw new Error(
    //     `Impossible de dimensionner: Ns_min (${Ns_min}) > Ns_max (${Ns_max}). ` +
    //       `Vérifiez les contraintes de tension onduleur ou tension batterie. ` +
    //       `Contraintes: Vmpp_chaud=${tension_mpp_min.toFixed(1)}V, ` +
    //       `Vmpp_froid=${tension_mpp_max.toFixed(1)}V, ` +
    //       `Voc_froid=${voc_module_froid.toFixed(1)}V.`
    //   );
    // }

    // // Choix optimal: valeur médiane pour centrer dans plage MPPT
    // // CORRECTION: Si la plage est large, on privilégie un Ns qui maximise
    // // la puissance tout en restant loin des limites (marge de sécurité 10%)
    // const Ns = Math.round((Ns_min + Ns_max) / 2);

    // // --- Vérification finale Voc avec Ns CHOISI ---
    // // CORRECTION: Vérification critique avec le Ns réel, pas Ns_max
    // const vocStringFroidReel = Ns * voc_module_froid;
    // if (
    //   contraintesOnduleur &&
    //   vocStringFroidReel > contraintesOnduleur.tensionDCMax
    // ) {
    //   // Sécurité: ne devrait pas arriver si Ns_max_voc est correct
    //   throw new Error(
    //     `CRITIQUE SECURITE: Voc string à froid (${vocStringFroidReel.toFixed(
    //       1
    //     )}V) ` +
    //       `dépasse tensionDCMax onduleur (${contraintesOnduleur.tensionDCMax}V) ` +
    //       `avec Ns=${Ns}. Réduire Ns ou changer module/onduleur.`
    //   );
    // }

    // // --- Calcul Np (strings en parallèle) ---
    // // CORRECTION: La puissance requise est en Wc STC.
    // // On doit couvrir cette puissance même à chaud (pire cas).
    // // Puissance module à chaud (déclassée)
    // const puissanceModuleChaud =
    //   puissanceCreteModule * (1 + beta * (tCellMax - 25));

    // // CORRECTION: Protection contre puissance négative ou nulle
    // const puissanceModuleEffective = Math.max(
    //   puissanceModuleChaud,
    //   puissanceCreteModule * 0.5
    // );

    // // Nombre total modules minimum pour puissance requise
    // const nbModulesMin = Math.ceil(puissanceCretePV / puissanceModuleEffective);
    // const Np = Math.ceil(nbModulesMin / Ns);

    // const totalPanneaux = Ns * Np;

    // // Puissances installées (min à chaud, max à froid)
    // const puissanceModuleFroid =
    //   puissanceCreteModule * (1 + beta * (tCellMin - 25));

    // const puissancePVInstalleeMin = totalPanneaux * puissanceModuleChaud;
    // const puissancePVInstalleeMax = totalPanneaux * puissanceModuleFroid;

    // // CORRECTION: Puissance nominale STC (pour ratio DC/AC correct)
    // const puissancePVInstalleeSTC = totalPanneaux * puissanceCreteModule;

    return {
      appareil: "panneaux photovoltaiques",
      configuration,
      tensionParcPV:
        configuration === "basse_tension"
          ? tensionSystemeBatterie ?? undefined
          : undefined,
      panneauxParString: Ns,
      stringsEnParallele: Np,
      totalPanneaux: totalPanneaux,
      tensionStringSTC: Ns * tensionMPP,
      tensionStringMin: Ns * tension_mpp_min, // Vmpp condition chaude
      tensionStringMax: Ns * tension_mpp_max, // Vmpp condition froide
      vocStringFroid: Ns * voc_module_froid, // VOC CRITIQUE sécurité
      puissancePVInstallee: {
        min: Math.round(puissancePVInstalleeMin),
        max: Math.round(puissancePVInstalleeMax),
        stc: Math.round(puissancePVInstalleeSTC), // AJOUT: puissance nominale
      },
      _temperaturesCellule: {
        tCellMin: Math.round(tCellMin * 10) / 10,
        tCellMax: Math.round(tCellMax * 10) / 10,
      },
      _tensionModuleCorrigee: {
        mppMin: Math.round(tension_mpp_min * 100) / 100,
        mppMax: Math.round(tension_mpp_max * 100) / 100,
        vocFroid: Math.round(voc_module_froid * 100) / 100,
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
      puissancePVInstallee,
    } = resultatsModules;

    const {
      tensionVoc,
      tensionMPP,
      courantCourtCircuit: Isc,
      coeffTempTension,
      noct,
    } = panneauParametres;

    const noct_module = noct ?? 45;
    const { temperatureMin, temperatureMax } = temperaturesAttendue;

    // Recalcul ou réutilisation températures
    const tCellMin =
      _temperaturesCellule?.tCellMin ??
      temperatureCellule(temperatureMin, 200, noct_module);
    const tCellMax =
      _temperaturesCellule?.tCellMax ??
      temperatureCellule(temperatureMax, irradianceMax, noct_module);

    // --- Grandeurs électriques du champ ---

    // CORRECTION: Coefficient température négatif pour tension
    const beta = -Math.abs(coeffTempTension);

    // Voc champ à froid (sécurité absolue)
    const vocModuleFroid =
      _tensionModuleCorrigee?.vocFroid ??
      tensionVoc * (1 + beta * (tCellMin - 25));
    const vocChampFroidCalc = Ns * vocModuleFroid;

    // Vmpp champ à chaud (risque décrochage MPPT)
    const vmppModuleChaud =
      _tensionModuleCorrigee?.mppMin ??
      tensionMPP * (1 + beta * (tCellMax - 25));
    const vmppChampChaud = Ns * vmppModuleChaud;

    // CORRECTION: Vmpp champ à froid (risque dépassement MPPT max)
    const vmppModuleFroid =
      _tensionModuleCorrigee?.mppMax ??
      tensionMPP * (1 + beta * (tCellMin - 25));
    const vmppChampFroid = Ns * vmppModuleFroid;

    // Vmpp nominal (STC)
    const vmppNominal = Ns * tensionMPP;

    // Isc champ à irradiance max avec facteur de sécurité IEC 62109
    const facteurIrradiance = irradianceMax / IRRADIANCE_STC;
    const iscChampBrut = Np * Isc * facteurIrradiance;
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

    const puissanceACMin = Math.round(puissanceChampsWcSTC / ratioMax);
    const puissanceACRecommandee = Math.round(
      puissanceChampsWcSTC / ratioCible
    );
    const puissanceACMax = Math.round(puissanceChampsWcSTC / ratioMin);

    const ratioDCAC = onduleurCandidat
      ? puissanceChampsWcSTC / onduleurCandidat.puissanceACNominale
      : puissanceChampsWcSTC / puissanceACRecommandee;

    // Évaluation ratio
    let evaluationRatio: ResultatOnduleur["dimensionnement"]["evaluationRatio"];
    if (ratioDCAC < ratioMin) evaluationRatio = "sous-dimensionne";
    else if (ratioDCAC <= 1.25) evaluationRatio = "optimal";
    else if (ratioDCAC <= ratioMax) evaluationRatio = "acceptable";
    else evaluationRatio = "eleve";

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
              onduleurCandidat.tensionDCMax / vocModuleFroid
            )}.`
        );
      }
      if (!vmppMinOk) {
        avertissements.push(
          `Vmpp champ à chaud (${vmppChampChaud.toFixed(1)} V) < ` +
            `tensionMPPTMin (${onduleurCandidat.tensionMPPTMin} V) - Risque décrochage MPPT hiver. ` +
            `Ns doit être ≥ ${Math.ceil(
              onduleurCandidat.tensionMPPTMin / vmppModuleChaud
            )}.`
        );
      }
      if (!vmppMaxOk) {
        erreurs.push(
          `Vmpp champ à froid (${vmppChampFroid.toFixed(1)} V) > ` +
            `tensionMPPTMax (${onduleurCandidat.tensionMPPTMax} V) - MPPT hors plage hiver. ` +
            `Ns doit être ≤ ${Math.floor(
              onduleurCandidat.tensionMPPTMax / vmppModuleFroid
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
                (Isc * facteurIrradiance * FACTEUR_SECURITE_COURANT)
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
