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
 * Pour la temperature min, on suppose le matin, avec le froid de la nuit et sans rayonnement
 * Donc le panneau est presque à la temperature de l'air
 * Peut etre il y a aussi le vent mais on verra ensuite
 */
const temperatureCelluleMinMax = (
  tAmbient: TemperaturesMinMax,
  irradianceMax: number, //G
  noct: number // Temperature noct de la cellule)
): {
  Tmin: number;
  Tmax: number;
} => {
  if (!tAmbient) {
    throw new Error("Le paramètre tAmbient est obligatoire.");
  }

  const { temperatureMin: tAmbientMin, temperatureMax: tAmbientMax } = tAmbient;

  if (typeof tAmbientMin !== "number" || typeof tAmbientMax !== "number") {
    throw new Error(
      "Les températures ambiantes min et max doivent être des nombres."
    );
  }
  if (tAmbientMin > tAmbientMax) {
    throw new Error(
      `Cohérence température : la température minimale (${tAmbientMin}°C) ne peut pas être supérieure à la maximale (${tAmbientMax}°C).`
    );
  }

  if (typeof irradianceMax !== "number" || isNaN(irradianceMax)) {
    throw new Error("L'irradiance maximale doit être un nombre valide.");
  }
  if (irradianceMax < 0) {
    throw new Error(
      `L'irradiance ne peut pas être négative (reçu: ${irradianceMax} W/m²).`
    );
  }
  if (irradianceMax > 1500) {
    // Alerte ou blocage si la valeur dépasse le rayonnement physique maximal sur Terre (~1360 W/m² hors atmosphère)
    throw new Error(
      `L'irradiance maximale semble irréaliste (reçu: ${irradianceMax} W/m²). Elle doit être inférieure à 1500 W/m².`
    );
  }

  if (typeof noct !== "number" || isNaN(noct)) {
    throw new Error("La valeur NOCT doit être un nombre valide.");
  }
  // Un NOCT normal de panneau silicium tourne généralement entre 40°C et 50°C
  if (noct < 30 || noct > 65) {
    throw new Error(
      `La valeur NOCT (${noct}°C) est en dehors des plages constructeurs réalistes (généralement entre 30°C et 65°C).`
    );
  }

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
  puissanceCretePV: number,
  typeSysteme: TypeSystemePV = "off-grid" // "off-grid" par défaut pour sécuriser le calcul
): {
  success: boolean;
  config: ConfigurationTension;
  tension: number;
  error?: string;
} => {
  if (typeof puissanceCretePV !== "number" || isNaN(puissanceCretePV)) {
    return {
      success: false,
      config: "indefini",
      tension: 0,
      error: "La puissance crête doit être un nombre valide.",
    };
  }

  if (puissanceCretePV <= 0) {
    return {
      success: false,
      config: "indefini",
      tension: 0,
      error: "La puissance crête ne peut être nulle (0W) ou inférieure à 0 W.",
    };
  }

  if (puissanceCretePV > 50000000) {
    // 50 MWc
    return {
      success: false,
      config: "indefini",
      tension: 0,
      error: "La puissance crête dépasse les limites de cet outil (50MWc).",
    };
  }

  let tensionSystem: number = 24;
  let configuration: ConfigurationTension = "basse_tension";

  if (typeSysteme === "off-grid" || typeSysteme === "hybride") {
    // Monde du stockage / Très Basse Tension (TBT) pour la sécurité, éviter les risque d'électrisation dangeureux et les standards batteries
    if (puissanceCretePV <= 800) {
      tensionSystem = 12; // Petits kits (éclairage, site isolé minimaliste)
      configuration = "basse_tension";
    } else if (puissanceCretePV > 800 && puissanceCretePV <= 2500) {
      tensionSystem = 24; // Standard petites habitations / pompage
      configuration = "basse_tension";
    } else {
      // Au-delà de 2500W en site isolé ou hybride résidentiel, le 48V est le standard.
      // Même pour 10 kWc ou 15 kWc, d'après ce que j'ai compris,
      // on multiplie souvent les onduleurs ou les régulateurs MPPT en parallèle
      // branchés sur un gros banc de batteries en 48V (ex: batteries Lithium LiFePO4).
      tensionSystem = 48;
      configuration = "basse_tension";
    }
  } else if (typeSysteme === "on-grid") {
    // Injection réseau directe (Onduleurs de chaîne sans contrainte de batterie basse tension)
    if (puissanceCretePV <= 3000) {
      // Petit résidentiel monophasé : les onduleurs string acceptent généralement jusqu'à 500V ou 600V max,
      // mais avec peu de panneaux, la tension optimale de fonctionnement (MPPT) tourne autour de 300V ou 360V.
      tensionSystem = 360;
      configuration = "basse_tension";
    } else if (puissanceCretePV > 3000 && puissanceCretePV <= 30000) {
      // Résidentiel supérieur / Petit tertiaire (Onduleurs triphasés standards)
      // La tension nominale de la chaîne de panneaux se situe idéalement autour de 600V DC.
      tensionSystem = 600;
      configuration = "haute_tension";
    } else if (puissanceCretePV > 30000 && puissanceCretePV <= 250000) {
      // Tertiaire et Industriel (C&I) : Standard des onduleurs de chaînes industriels (Max 1000V à vide).
      tensionSystem = 1000;
      configuration = "haute_tension";
    } else {
      // Grandes centrales d'injection (> 250 kWc) : Standard moderne à 1500V DC pour réduire le cuivre au maximum.
      tensionSystem = 1500;
      configuration = "haute_tension";
    }
  }

  return {
    success: true,
    config: configuration,
    tension: tensionSystem,
  };
};
// WARNING:

/**
 * IDEA: En fonction du climat (chaud, froid, tempéré, ...) on a differentes priorités
 * En climat chaud, on va chercher à se rapprocher de N_panneaux_par_string_min pour éviter la sous-tension en plein soleil
 * donc Fclim -> 0
 * En climat froid, on va chercher à se rapprocher de N_panneaux_par_string_max pour maximiser la tension sans griller l'onduleur
 * donc Fclim -> 1
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
): {
  success: boolean;
  nombrePanneaux: number;
  facteurClimatique: number;
  error?: string;
} => {
  if (
    typeof Nmin !== "number" ||
    typeof Nmax !== "number" ||
    isNaN(Nmin) ||
    isNaN(Nmax)
  ) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Nmin et Nmax doivent être des nombres valides.",
    };
  }
  if (Nmin < 0 || Nmax < 0) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Le nombre de panneaux ne peut pas être négatif.",
    };
  }
  if (Nmin > Nmax) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Nmin ne peut pas être supérieur à Nmax.",
    };
  }

  if (!temperaturesAttendue) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "L'objet des températures attendues est requis.",
    };
  }

  const { temperatureMin: Tmin, temperatureMax: Tmax } = temperaturesAttendue;

  if (
    typeof Tmin !== "number" ||
    typeof Tmax !== "number" ||
    isNaN(Tmin) ||
    isNaN(Tmax)
  ) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: "Les températures min et max doivent être des nombres valides.",
    };
  }
  if (Tmin >= Tmax) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error:
        "La température minimale doit être strictement inférieure à la température maximale (évite la division par zéro).",
    };
  }

  const amplitude_thermique = Tmax - Tmin; // A
  if (amplitude_thermique === T_REF_Noct) {
    return {
      success: false,
      nombrePanneaux: 0,
      facteurClimatique: 0,
      error: `Asymptote mathématique : l'amplitude thermique (${amplitude_thermique}°C) est exactement égale à T_REF_NOCT (${T_REF_Noct}°C), ce qui génère une division par zéro.`,
    };
  }

  const temperature_moyenne = (Tmax + Tmin) / 2; // Tmoy

  // variable climatique X
  const variable_climatique =
    (T_REF_Noct - temperature_moyenne) / (amplitude_thermique - T_REF_Noct);

  // sensibilité k
  const sensibilite_climatique =
    1 +
    amplitude_thermique / A_REF +
    (Math.abs(Tmax - T_REF_Noct) + Math.abs(Tmin - T_REF_Noct)) / (2 * T_REF);

  // Fclim strictement entre 0 et 1
  const facteur_climatique =
    1 / (1 + Math.exp(-sensibilite_climatique * variable_climatique));

  // Nombre de panneaux théorique continu
  const resultatTheorique = Nmin + facteur_climatique * (Nmax - Nmin);

  return {
    success: true,
    nombrePanneaux: Math.round(resultatTheorique), // Arrondit à l'entier le plus proche (vrai nombre de panneaux physiques)
    facteurClimatique: Number(facteur_climatique.toFixed(4)),
  };
};

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
    pertesTotales: number; // En pourcentage (%)
    PR: number; // Facteur compris entre 0 et 1
  } {
    // Dictionnaire des pertes par défaut selon la configuration terrain
    const tablePertes: Record<TypeInstallationPourPertes, number> = {
      HAUTE_QUALITE: 10, // Conditions labo, nettoyage fréquent, câblage optimisé
      STANDARD: 18, // Configuration résidentielle classique bien exécutée
      POUSSIEREUX: 22, // Zones à forte sédimentation/poussière sans nettoyage régulier
      FAIBLE_MAINTENANCE: 25, // Pas de suivi, dégradation non surveillée
      CABLE_LONG: 25, // Grosses pertes en ligne DC ou AC dues à la distance
      ANCIEN: 28, // Vieillissement prématuré des composants / dégradation induite
    };

    // fallback si le type passé est invalide au runtime
    const pertes_system = tablePertes[typeInstallation] ?? tablePertes.STANDARD;

    // Performance Ratio (PR)
    const performance_ratio = (100 - pertes_system) / 100;

    return {
      pertesTotales: pertes_system,
      PR: Number(performance_ratio.toFixed(2)), // Sécurité sur les arrondis de division JS
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
    energieCrete: number, // Wh/j (Ignoré si pompageSolaire = true)
    PSH: number, // h/j (Heures d'ensoleillement équivalentes à 1000W/m²)
    PR: number, // Facteur 0 à 1 (Performance Ratio)
    pompageCaracteristiques?: PompageSolaireCaracteristiques | null,
    rendementOnduleurMTTP?: number | null
  ): { success: boolean; puissanceCrete: number; error?: string } {
    // Validations des variables communes fondamentales pour eviter les divisions par zéro
    if (typeof PSH !== "number" || isNaN(PSH) || PSH <= 0) {
      return {
        success: false,
        puissanceCrete: 0,
        error:
          "Le PSH (Peak Sun Hours) doit être un nombre strictement supérieur à 0.",
      };
    }
    if (typeof PR !== "number" || isNaN(PR) || PR <= 0 || PR > 1) {
      return {
        success: false,
        puissanceCrete: 0,
        error:
          "Le Performance Ratio (PR) doit être compris strictement entre 0 et 1.",
      };
    }

    let Pc: number;

    // Pompage Solaire Direct
    if (pompageSolaire) {
      if (!pompageCaracteristiques) {
        return {
          success: false,
          puissanceCrete: 0,
          error:
            "Les caractéristiques hydrauliques de pompage sont obligatoires lorsque le mode pompage est activé.",
        };
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
        return {
          success: false,
          puissanceCrete: 0,
          error:
            "Toutes les caractéristiques de pompage doivent être des nombres valides et supérieurs à 0.",
        };
      }

      if (rendementPompe > 1) {
        return {
          success: false,
          puissanceCrete: 0,
          error:
            "Le rendement de la pompe ne peut pas être supérieur à 1 (100%).",
        };
      }

      // Calcul de l'énergie hydraulique requise par jour (en Wh/j)
      // Formule : (rho * g * Q * HMT) / (3600 * rendement_pompe)
      const E_hydraulique =
        (masseVolumique * accelerationPesanteur * debit * hauteurMano) /
        (3600 * rendementPompe);

      // Détermination du rendement de l'onduleur/variateur de pompage
      const rendementOnduleur = rendementOnduleurMTTP ?? 0.98;
      if (rendementOnduleur <= 0 || rendementOnduleur > 1) {
        return {
          success: false,
          puissanceCrete: 0,
          error: "Le rendement de l'onduleur doit être compris entre 0 et 1.",
        };
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
        return {
          success: false,
          puissanceCrete: 0,
          error:
            "L'énergie de charge (Wh/j) doit être un nombre strictement supérieur à 0.",
        };
      }

      // Formule classique : Pc = E_charge / (PSH * PR)
      Pc = energieCrete / (PSH * PR);
    }

    // Retour propre avec arrondi de sécurité supérieur
    return {
      success: true,
      puissanceCrete: Math.ceil(Pc),
    };
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
  ): { success: boolean; data?: ResultatModulesPV; error?: string } {
    if (
      !panneauParametres ||
      typeof puissanceCretePV !== "number" ||
      puissanceCretePV <= 0 ||
      isNaN(puissanceCretePV)
    ) {
      return {
        success: false,
        error: "Paramètres de panneaux ou puissance crête cible invalides.",
      };
    }

    const {
      puissanceCreteModule,
      tensionMPP,
      tensionVoc,
      courantCourtCircuit,
      coeffTempTension,
      coeffTempPuissance,
      noct,
    } = panneauParametres;

    // Validation de sécurité sur le panneau pour éviter des divisions par 0 en désordre
    if (
      [puissanceCreteModule, tensionMPP, tensionVoc, courantCourtCircuit].some(
        (val) => typeof val !== "number" || val <= 0 || isNaN(val)
      )
    ) {
      return {
        success: false,
        error:
          "Les caractéristiques électriques STC du panneau doivent être des nombres strictement positifs.",
      };
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
      return {
        success: false,
        error: `Erreur calcul température cellule : ${err.message}`,
      };
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
      return {
        success: false,
        error:
          "Les tensions corrigées du panneau sont aberrantes (inférieures ou égales à 0V). Vérifiez les températures.",
      };
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
        return {
          success: false,
          error: `Calcul tension système échoué : ${resTension.error}`,
        };
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
      return {
        success: false,
        error: `Erreur dans la répartition climatique : ${
          resClimatString.error || resClimatPara.error
        }`,
      };
    }

    const N_panneaux_par_string = resClimatString.nombrePanneaux;
    const N_string_en_parallele = resClimatPara.nombrePanneaux || 1; // Sécurité : au moins 1 string en parallèle

    // Formatage du résultat final propre
    return {
      success: true,
      data: {
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
      },
    };
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

    const { tCellMin, tCellMax } = _temperaturesCellule;

    // --- 1. Grandeurs électriques du champ PV ---
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

    // --- 2. Bornes de dimensionnement théorique ---
    const ratioCible = 1.15;
    const ratioMin = 1.0;
    const ratioMax = 1.4;

    const puissanceACMin = puissanceChampsWcSTC / ratioMax;
    const puissanceACRecommandee = puissanceChampsWcSTC / ratioCible;
    const puissanceACMax = puissanceChampsWcSTC / ratioMin;

    // --- 3. Analyse de l'onduleur candidat ---
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

      // 1. Protection absolue contre les surtensions (Voc à froid)
      const vocOk =
        onduleurCandidat.tensionDCMax > 0 &&
        vocChampFroidCalc < onduleurCandidat.tensionDCMax;

      // 2. Plage MPPT basse (à chaud)
      const vmppMinOk =
        onduleurCandidat.tensionMPPTMin > 0 &&
        vmppChampChaud > onduleurCandidat.tensionMPPTMin;

      // 3. Plage MPPT haute (à froid)
      const vmppMaxOk =
        onduleurCandidat.tensionMPPTMax > 0 &&
        vmppChampFroid < onduleurCandidat.tensionMPPTMax;
      const vmppPlageOk = vmppMinOk && vmppMaxOk;

      // 4. Intensité maximale admissible (IEC 62109)
      const iscOk =
        onduleurCandidat.courantDCMax > 0 &&
        iscChamp <= onduleurCandidat.courantDCMax;

      // 5. Écrêtage ou surcharge DC
      const puissanceDCMaxOnduleur =
        onduleurCandidat.puissanceDCMax && onduleurCandidat.puissanceDCMax > 0
          ? onduleurCandidat.puissanceDCMax
          : onduleurCandidat.puissanceACNominale * 1.1;
      const pdcOk = puissanceChampsWcSTC <= puissanceDCMaxOnduleur;

      // 6. Capacité à couvrir le talon de charge AC AC
      const chargeOk =
        onduleurCandidat.puissanceACNominale >= puissanceChargeContinue;

      // 7. Courant d'appel moteurs (Surcharge transitoire)
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

      // --- 4. Génération de rapports d'erreurs explicites pour l'ingénieur ---
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
          `Attention: La capacité de surcharge transitoire (${puissanceSurcharge} W) est inférieure à la puissance de pointe demandée au démarrage (${puissanceDemarrage} W). ` +
            `Risque de mise en sécurité de l'onduleur au démarrage des moteurs.`
        );
      }
    }

    // --- 5. Sortie standardisée ---
    return {
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
  }
}

export const puissanceCretePVService = new PuissanceCretePVService();
