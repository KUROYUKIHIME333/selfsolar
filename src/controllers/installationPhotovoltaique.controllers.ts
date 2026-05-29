import { FastifyRequest, FastifyReply } from "fastify";
import { bilanConsommationService } from "../services/installationPhotovoltaique/bilanConso.services.js";
import { parametresSiteService } from "../services/installationPhotovoltaique/parametreSite.services.js";
import { puissanceCretePVService } from "../services/installationPhotovoltaique/puissancePVCrete.services.js";
import { stockageService } from "../services/installationPhotovoltaique/stockage.services.js";
//import { cablageEtProtectionsService } from "../services/installationPhotovoltaique/cablageProtection.services.js";
import type {
  //DimensionnementPVRequest,
  //DimensionnementPVResponse,
  //ResultatStockage,
  ResultatModulesPV,
  Equipement,
  Localisation,
  ParametresSTCPanneau,
  TypeInstallationPourPertes,
  TypeSystemePV,
  TechnologieBatterie,
  // MateriauConducteur,
  // MethodePose,
  ParametresOnduleur,
  PompageSolaireCaracteristiques,
  TemperaturesMinMax,
  ConfigurationTension,
} from "../types/installationPhotovoltaique.types.js";
import { TypeInstallationPourPertesArray } from "../types/installationPhotovoltaique.types.js";
import { LISTE_PANNEAUX } from "../utils/modulesPVListe.utils.js";
import { LISTE_BATTERIES } from "../utils/batteriesListe.utils.js";
import {
  controllerErrorHandler,
  sendError,
  sendSuccess,
} from "../utils/handlers.utils.js";
import { CONFIG_TECHNOLOGIES } from "../utils/constantesPhysiques.utils.js";

const TARGET_YEAR_IN_FUTURE: number = 40;

// Contrôleur d'installation photovoltaïque
// Orchestre les services de dimensionnement selon normes NFC 15-100, IEC 61215, etc.
export class InstallationPhotovoltaiqueController {
  /**
   * Analyse la consommation électrique des équipements
   */
  async analyserConsommation(
    request: FastifyRequest<{
      Body: {
        equipements: Equipement[];
        facteurFoisonnementGlobal?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { equipements, facteurFoisonnementGlobal } = request.body;

      if (
        !equipements ||
        !Array.isArray(equipements) ||
        equipements.length === 0
      ) {
        return sendError(
          reply,
          "La liste des équipements est vide ou invalide.",
          400
        );
      }

      if (
        facteurFoisonnementGlobal !== undefined &&
        (facteurFoisonnementGlobal <= 0 || facteurFoisonnementGlobal > 1)
      ) {
        return sendError(
          reply,
          "Le coefficient de simultanéité global (facteurFoisonnementGlobal) doit être compris entre 0 et 1.",
          400
        );
      }

      const energieJournaliereTotal =
        bilanConsommationService.energieTotal(equipements);

      const puissanceAppeleeMax = bilanConsommationService.puissanceAppelee(
        equipements,
        facteurFoisonnementGlobal ?? 0.8
      );

      const puissanceInstalleeTotal =
        bilanConsommationService.puissanceInstaleeAC(equipements);

      const puissancePicDemarrage =
        bilanConsommationService.puissancePic(equipements);

      return sendSuccess(
        reply,
        {
          energieJournaliereWh: energieJournaliereTotal,
          puissanceAppeleeW: puissanceAppeleeMax,
          puissanceInstalleeW: puissanceInstalleeTotal,
          puissancePicW: puissancePicDemarrage,
        },
        200
      );
    } catch (error: unknown) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Analyse Conso]"),
        500
      );
    }
  }

  /**
   * Analyse des données météorologiques
   * Elles sont récupérées de PVGIS (voir parametreSite.services.ts)
   */
  async analyserGeographie(
    request: FastifyRequest<{ Body: { localisation: Localisation } }>,
    reply: FastifyReply
  ) {
    try {
      const { localisation } = request.body;

      if (!localisation || !localisation.lat || !localisation.long) {
        return sendError(
          reply,
          "La localisation du site doit etre au format {lat: number; long: number; altitude: number | undefined}",
          400
        );
      }

      if (localisation.lat < -90 || localisation.lat > 90) {
        return sendError(
          reply,
          "La latitude doit être comprise entre -90 et 90",
          400
        );
      }

      if (localisation.long < -180 || localisation.long > 180) {
        return sendError(
          reply,
          "La longitude doit être comprise entre -180 et 180",
          400
        );
      }

      const targetYear = new Date().getFullYear() + TARGET_YEAR_IN_FUTURE;
      const orientationEtAngle = parametresSiteService.angleOptimal(
        localisation.lat
      );

      const { angleOptimalPVGIS, ...leReste } =
        await parametresSiteService.PVGISDatas(localisation, targetYear);

      return sendSuccess(
        reply,
        {
          localisation: localisation,
          orientation: orientationEtAngle.orientation,
          angle: orientationEtAngle.angle,
          angleOptimal: angleOptimalPVGIS,
          ...leReste,
        },
        200
      );
    } catch (error: unknown) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Analyse Geographique]"),
        500
      );
    }
  }

  /**
   * Obtention de la capacité du bloc batteries
   * Si besoin
   */
  async etablirStockage(
    request: FastifyRequest<{
      Body: {
        technologieBattery: TechnologieBatterie;
        energieJournaliere_Wh: number;
        autonomieBatterie_jours: number;
        tensionSystemeBatterie_V: number;
        temperatureAmbiante_C?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        technologieBattery,
        energieJournaliere_Wh,
        autonomieBatterie_jours,
        tensionSystemeBatterie_V,
        temperatureAmbiante_C,
      } = request.body;

      if (!technologieBattery) {
        return sendError(
          reply,
          "Renseigner le type de batterie (Plomb-acide, AGM/Gel, LiFePO4, Lithium NMC/NCA ou NiCd)",
          400
        );
      }
      if (
        !energieJournaliere_Wh ||
        !autonomieBatterie_jours ||
        !tensionSystemeBatterie_V
      ) {
        return sendError(
          reply,
          "Pour calculer la capacité du stockage, il faut la consommation journalière (Ec), le nombre de jours d'autonomie (N) et la tension du système (Us)",
          400
        );
      }

      const stockageCalcule = stockageService.capaciteStockage(
        technologieBattery,
        energieJournaliere_Wh,
        autonomieBatterie_jours,
        tensionSystemeBatterie_V,
        temperatureAmbiante_C
      );

      return sendSuccess(reply, stockageCalcule, 200);
    } catch (error: unknown) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Determiner batteries]"),
        500
      );
    }
  }

  /**
   * Obtention de la puissance crète et des pertes
   */
  async etablirPuissanceCrete(
    request: FastifyRequest<{
      Body: {
        typeInstallation: TypeInstallationPourPertes;
        pompageSolaire: boolean;
        energieCrete_Wh?: number;
        PSH_heuresParJour: number;
        avecStockage: boolean;
        pompageCaracteristiques?: PompageSolaireCaracteristiques;
        rendementOnduleurMPPT?: number;
        technologieBatteries?: TechnologieBatterie;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        typeInstallation,
        pompageSolaire,
        energieCrete_Wh,
        PSH_heuresParJour,
        avecStockage,
        pompageCaracteristiques,
        rendementOnduleurMPPT,
        technologieBatteries,
      } = request.body;

      const typeTypeInstallation: boolean =
        TypeInstallationPourPertesArray.includes(typeInstallation);

      if (!PSH_heuresParJour) {
        return sendError(
          reply,
          "PSH (Heures d'ensoleillement équivalentes à 1000W/m²) doit être renseigné",
          400
        );
      }
      if (!typeInstallation || !typeTypeInstallation) {
        return sendError(
          reply,
          "Le type d'installation doit être choisi. Choix possibles: HAUTE_QUALITE, STANDARD, POUSSIEREUX, FAIBLE_MAINTENANCE, ANCIEN ou CABLE_LONG",
          400
        );
      }
      if (
        (!pompageSolaire && !energieCrete_Wh) ||
        (pompageSolaire && energieCrete_Wh)
      ) {
        return sendError(
          reply,
          "S'il s'agit d'une installation de pompage solaire, renseigner ses caractéristiques. S'il n'en est rien, renseigner les equipements. Ne pas mélanger les 2",
          400
        );
      }

      const { pertesTotales, PR } =
        puissanceCretePVService.performanceRatio(typeInstallation);

      let Ec = energieCrete_Wh;

      if (avecStockage && technologieBatteries && energieCrete_Wh) {
        const K =
          CONFIG_TECHNOLOGIES[technologieBatteries]["facteurMajorationCharge"];
        Ec = energieCrete_Wh * K;
      }

      const {
        success: PcSuccess,
        puissanceCrete: PcValue,
        error: PcError,
      } = puissanceCretePVService.puissanceCretePV(
        pompageSolaire,
        Ec,
        PSH_heuresParJour,
        PR,
        pompageCaracteristiques,
        rendementOnduleurMPPT
      );

      if (!PcSuccess || PcError) {
        return sendError(reply, PcError, 400);
      }

      return sendSuccess(
        reply,
        {
          Pc: PcValue,
          pertesTotales: pertesTotales,
        },
        200
      );
    } catch (error: unknown) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Puissance crete calculs]"),
        500
      );
    }
  }

  /**
   * Obtention de le nombres des panneaux photovoltaiques et leurs caractéristiques
   */
  async dimensionnerModulesPV(
    request: FastifyRequest<{
      Body: {
        parametresPanneau: ParametresSTCPanneau;
        puissanceCretePV_Wc: number;
        temperaturesAttendue: TemperaturesMinMax;
        irradianceMax_W_m2: number;
        tensionSysteme_V: number;
        configurationTensionSysteme: ConfigurationTension;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        parametresPanneau,
        puissanceCretePV_Wc,
        temperaturesAttendue,
        irradianceMax_W_m2,
        tensionSysteme_V,
        configurationTensionSysteme,
      } = request.body;

      if (!parametresPanneau || !puissanceCretePV_Wc) {
        return sendError(
          reply,
          "Les paramètres du module ainsi que la puissance crête calculée du champ doivent être renseignées",
          400
        );
      }
      if (!temperaturesAttendue || !irradianceMax_W_m2) {
        return sendError(
          reply,
          "Les temperatures ainsi que l'irradiance maximum doivent être renseignées",
          400
        );
      }
      if (!tensionSysteme_V || !configurationTensionSysteme) {
        return sendError(
          reply,
          "La tension du système (en Courant continu) doit être renseignée",
          400
        );
      }

      const {
        success: modulesPVsuccess,
        data: modulesPVdata,
        error: modulesPVerror,
      } = puissanceCretePVService.modulesPV(
        parametresPanneau,
        puissanceCretePV_Wc,
        temperaturesAttendue,
        irradianceMax_W_m2,
        tensionSysteme_V,
        configurationTensionSysteme
      );

      if (!modulesPVsuccess || modulesPVerror) {
        return sendError(reply, modulesPVerror, 400);
      }

      return sendSuccess(reply, modulesPVdata, 200);
    } catch (error: unknown) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[nombres de panneaux]"),
        500
      );
    }
  }

  /**
   * Obtention de le nombres de batteries et leurs caractéristiques
   */
  async dimensionnerModulesBatteries(
    request: FastifyRequest<{
      Body: {
        tensionSysteme_V: number;
        tensionUnitaireBatterie_V: number;
        capaciteUnitaireBatterie_Ah: number;
        capaciteTotaleRequise_Ah: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        tensionSysteme_V,
        tensionUnitaireBatterie_V,
        capaciteUnitaireBatterie_Ah,
        capaciteTotaleRequise_Ah,
      } = request.body;

      if (
        !tensionSysteme_V ||
        !tensionUnitaireBatterie_V ||
        !capaciteUnitaireBatterie_Ah ||
        !capaciteTotaleRequise_Ah
      ) {
        return sendError(
          reply,
          "Toutes les caractéristiques électriques unitaires et requises du banc de batteries doivent être renseignées.",
          400
        );
      }

      const dispositionBatt = stockageService.modulesBatteries(
        tensionSysteme_V,
        tensionUnitaireBatterie_V,
        capaciteUnitaireBatterie_Ah,
        capaciteTotaleRequise_Ah
      );

      return sendSuccess(reply, dispositionBatt, 200);
    } catch (error: unknown) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Configuration bloc batteries]"),
        500
      );
    }
  }

  /**
   * Vérification de l'onduleur proposé
   *Ou bien choix d'un onduleur adapté
   */
  async dimensionnerOnduleur(
    request: FastifyRequest<{
      Body: {
        resultats_modules: ResultatModulesPV;
        parametres_panneaux: ParametresSTCPanneau;
        irradiance_max: number;
        typeSysteme: TypeSystemePV;
        puissance_chargeContinue: number;
        onduleur_propose: ParametresOnduleur | null;
        puissance_demarrage: number | null;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        resultats_modules,
        parametres_panneaux,
        irradiance_max,
        typeSysteme,
        puissance_chargeContinue,
        onduleur_propose,
        puissance_demarrage,
      } = request.body;

      if (
        !resultats_modules ||
        !parametres_panneaux ||
        !irradiance_max ||
        !typeSysteme ||
        !puissance_chargeContinue
      ) {
        return sendError(
          reply,
          "Toutes les caractéristiques du système devant conditionner le choix de l'onduleur doivent être renseignées (panneaux, système, puissance, ...).",
          400
        );
      }

      const dispositionOnduleur = puissanceCretePVService.onduleur(
        resultats_modules,
        parametres_panneaux,
        irradiance_max,
        typeSysteme,
        puissance_chargeContinue,
        onduleur_propose,
        puissance_demarrage
      );

      return sendSuccess(reply, dispositionOnduleur, 200);
    } catch (error) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Choix Onduleur]"),
        500
      );
    }
  }

  /**
   * Endpoint principal de dimensionnement PV complet
   * Enchaîne tous les calculs: consommation, site, modules, onduleur, stockage, câblage
   */
  // async dimensionnerInstallation(
  //   request: FastifyRequest<{ Body: DimensionnementPVRequest }>,
  //   reply: FastifyReply
  // ): Promise<any> {
  //   const startTime = Date.now();

  //   try {
  //     const {
  //       localisation,
  //       equipements,
  //       typeInstallation,
  //       typeSysteme,
  //       parametresPanneau,
  //       temperaturesAttendue,
  //       autonomieBatterie,
  //       technologieBattery, // Note: attention à la propriété "technologieBatterie" vs "technologieBattery" du body
  //       technologieBatterie,
  //       contraintesOnduleur,
  //       cablage,
  //       pompageSolaire,
  //       pompageCaracteristiques,
  //       irradianceMax,
  //       facteurFoisonnementGlobal,
  //       tensionSystemeBatterie,
  //       modeleBatterie,
  //     } = request.body;

  //     // ========== 1. BILAN DE CONSOMMATION ==========
  //     const energieJournaliere =
  //       bilanConsommationService.energieTotal(equipements);
  //     const puissanceCreteCharge = bilanConsommationService.puissanceAppelee(
  //       equipements,
  //       facteurFoisonnementGlobal
  //     );

  //     if (energieJournaliere <= 0) {
  //       return sendError(reply, "Données invalides : L'énergie journalière calculée est nulle ou négative - vérifiez les équipements.", 400);
  //     }

  //     console.log("L'Ec", energieJournaliere);

  //     // ========== 2. PARAMÈTRES SITE ET RESSOURCE SOLAIRE ==========
  //     const parametresSite = await parametresSiteService.PVGISDatas(
  //       localisation
  //     );
  //     const angleOptimal = parametresSiteService.angleOptimal(localisation.lat);

  //     console.log("L'angle optimal et tout' :", JSON.stringify(angleOptimal));
  //     console.log("L'angle optimal et tout' :", angleOptimal);

  //     // ========== 3. PERFORMANCE RATIO ET PERTES ==========
  //     const { PR, pertesTotales } =
  //       await puissanceCretePVService.performanceRatio(
  //         typeInstallation,
  //         localisation
  //       );

  //     console.log(
  //       "Le ratio de performance calculée :",
  //       PR,
  //       " mais avec des pertes ",
  //       pertesTotales
  //     );

  //     // ========== 4. PUISSANCE CRÊTE PV REQUISE ==========
  //     const puissanceCretePV = puissanceCretePVService.puissanceCretePV(
  //       pompageSolaire || false,
  //       energieJournaliere,
  //       parametresSite.G_moy,
  //       PR,
  //       pompageCaracteristiques,
  //       contraintesOnduleur?.rendementMPPT
  //     );

  //     console.log(pompageCaracteristiques);
  //     console.log("La puisance crète calculée :", puissanceCreteCharge);

  //     // ========== 5. DIMENSIONNEMENT MODULES PV ==========
  //     let contraintesOnduleurModules = null;
  //     let tensionBatt = 24;
  //     let tensionConventionnelleSys = 48;

  //     if (typeSysteme !== "off-grid" && contraintesOnduleur) {
  //       contraintesOnduleurModules = {
  //         tensionMPPTMin: contraintesOnduleur.tensionMPPTMin,
  //         tensionMPPTMax: contraintesOnduleur.tensionMPPTMax,
  //         tensionDCMax: contraintesOnduleur.tensionDCMax,
  //         rendementMPPT: contraintesOnduleur.rendementMPPT,
  //       };
  //     } else if (typeSysteme === "off-grid") {
  //       if (puissanceCretePV < PALIERS_PC_BAS_TENSION8SYSTEME_PV) {
  //         tensionConventionnelleSys = 12;
  //       } else if (
  //         puissanceCretePV > PALIERS_PC_BAS_TENSION8SYSTEME_PV &&
  //         puissanceCretePV < PALIERS_PC_BAS_TENSION8SYSTEME_PV * 4
  //       ) {
  //         tensionConventionnelleSys = 24;
  //       } else if (puissanceCretePV > PALIERS_PC_BAS_TENSION8SYSTEME_PV * 20) {
  //         tensionConventionnelleSys = 96;
  //       }
  //       tensionBatt = tensionSystemeBatterie
  //         ? tensionSystemeBatterie
  //         : tensionConventionnelleSys;
  //     }

  //     const resultatModules = puissanceCretePVService.modulesPV(
  //       parametresPanneau,
  //       puissanceCretePV,
  //       temperaturesAttendue,
  //       parametresSite.G_moy,
  //       parametresSite.G_max,
  //       tensionBatt,
  //       contraintesOnduleurModules
  //     );

  //     console.log("Verification des modules : ", resultatModules);

  //     // ========== 6. VÉRIFICATION ONDULEUR ==========
  //     let resultatOnduleur = null;
  //     if (contraintesOnduleur) {
  //       resultatOnduleur = puissanceCretePVService.onduleur(
  //         resultatModules,
  //         parametresPanneau,
  //         temperaturesAttendue,
  //         irradianceMax || 1000,
  //         typeSysteme,
  //         puissanceCreteCharge,
  //         contraintesOnduleur,
  //         puissanceCreteCharge * 1.5
  //       );

  //       console.log("L'onduleur testé:", resultatOnduleur);
  //     }

  //     // ========== 7. DIMENSIONNEMENT STOCKAGE ==========
  //     let resultatStockage: ResultatStockage | null = null;
  //     if (modeleBatterie) {
  //       if (typeSysteme !== "on-grid" && autonomieBatterie) {
  //         const tensionSysteme =
  //           typeSysteme === "off-grid"
  //             ? tensionSystemeBatterie || tensionConventionnelleSys
  //             : 400;

  //         resultatStockage = stockageService.capaciteStockage(
  //           technologieBatterie || technologieBattery || "LiFePO4",
  //           energieJournaliere,
  //           autonomieBatterie,
  //           tensionSysteme,
  //           temperaturesAttendue.temperatureMax
  //         );

  //         const tensionUnitaire = modeleBatterie.v;
  //         const capaciteUnitaire = modeleBatterie.ah;

  //         const dispositionBatt = stockageService.modulesBatteries(
  //           tensionSysteme,
  //           tensionUnitaire,
  //           capaciteUnitaire,
  //           resultatStockage?.capacite.nominale_Ah
  //         );

  //         (resultatStockage as any).disposition = dispositionBatt;

  //         const bms = stockageService.regulateurBMS(
  //           puissanceCretePV,
  //           tensionSysteme,
  //           puissanceCreteCharge,
  //           resultatOnduleur?.dimensionnement.puissanceACRecommandee
  //             ? puissanceCreteCharge /
  //               resultatOnduleur.dimensionnement.puissanceACRecommandee
  //             : 0.95
  //         );
  //         (resultatStockage as any).bms = bms;
  //       }

  //       console.log("Les batteries:", resultatStockage);
  //     }

  //     // ========== 8. DIMENSIONNEMENT CÂBLAGE ET PROTECTIONS ==========
  //     const materiau = cablage?.materiau || "cuivre";
  //     const conditionEnv = cablage?.conditionEnvironnement || "chaud";

  //     const dimensionnementCablage =
  //       cablageEtProtectionsService.dimensionnerCablesDC(
  //         resultatModules,
  //         parametresPanneau,
  //         cablage?.longueurString || 15,
  //         cablage?.longueurPrincipalDC || 10,
  //         temperaturesAttendue.temperatureMax,
  //         resultatModules.stringsEnParallele,
  //         materiau,
  //         cablage?.methodePoseDC || "conduit_surface",
  //         conditionEnv
  //       );

  //     let dimensionnementAC = null;
  //     if (resultatOnduleur) {
  //       const puissanceAC =
  //         resultatOnduleur.dimensionnement.puissanceACRecommandee;
  //       const tensionAC = puissanceAC > 5000 ? 400 : 230;

  //       dimensionnementAC = cablageEtProtectionsService.dimensionnerCablageAC(
  //         puissanceAC,
  //         tensionAC,
  //         0.95,
  //         cablage?.longueurAC || 20,
  //         "mixte",
  //         30,
  //         cablage?.methodePoseAC || "conduit_encastre",
  //         materiau
  //       );

  //       dimensionnementCablage.cablageAC = dimensionnementAC;

  //       console.log("Les cables :", dimensionnementCablage);
  //     }

  //     // ========== 9. ASSEMBLAGE RÉPONSE ==========
  //     const chuteTensionGlobaleDC = dimensionnementCablage.cablesString[0]
  //       ? dimensionnementCablage.cablesString[0].chuteTensionPourcent +
  //         dimensionnementCablage.cablePrincipalDC.chuteTensionPourcent
  //       : 3;

  //     const response: DimensionnementPVResponse = {
  //       resume: {
  //         energieJournaliere_Wh: Math.round(energieJournaliere),
  //         puissanceCreteCharge_W: Math.round(puissanceCreteCharge),
  //         puissanceCretePV_Wc: Math.round(puissanceCretePV),
  //         ratioDCAC: resultatOnduleur?.dimensionnement.ratioDCAC,
  //         surfaceEstimee_m2: resultatModules.totalPanneaux * 2.0,
  //         nombreStrings: resultatModules.stringsEnParallele,
  //       },
  //       site: {
  //         localisation,
  //         angleOptimal,
  //         PSH_moisDefavorable: parametresSite.PSH,
  //         performanceRatio: Math.round(PR * 1000) / 1000,
  //         pertesTotales_pourcent: pertesTotales,
  //       },
  //       modulesPV: resultatModules,
  //       onduleur: resultatOnduleur,
  //       stockage: resultatStockage,
  //       cablage: dimensionnementCablage,
  //       conformite: {
  //         normesReference: [
  //           "NF C 15-100",
  //           "IEC 61215",
  //           "IEC 62109",
  //           "NF EN 50549",
  //           "IEC 62619",
  //           "IEC 61643-31",
  //         ],
  //         verificationVoc:
  //           resultatOnduleur?.verification?.details?.vocSousLimite ??
  //           resultatModules.vocStringFroid <
  //             (contraintesOnduleur?.tensionDCMax || Infinity),
  //         verificationMPPT:
  //           resultatOnduleur?.verification?.details?.vmppDansPlageMPPT ?? true,
  //         verificationIsc:
  //           resultatOnduleur?.verification?.details?.iscSousLimite ?? true,
  //         verificationChuteTension:
  //           chuteTensionGlobaleDC <= 3.0 &&
  //           (dimensionnementAC ? dimensionnementAC.chuteTension <= 5.0 : true),
  //         avertissements: [
  //           ...(resultatOnduleur?.avertissements || []),
  //           ...dimensionnementCablage.avertissements,
  //         ],
  //         erreurs: resultatOnduleur?.erreurs || [],
  //       },
  //       meta: {
  //         timestamp: new Date().toISOString(),
  //         versionCalculateur: "2.0.0-normes2024",
  //       },
  //     };

  //     const duration = Date.now() - startTime;
  //     request.log.info(`Dimensionnement PV complété en ${duration}ms`);

  //     return sendSuccess(reply, response, 200);
  //   } catch (error: any) {
  //     request.log.error(error);

  //     const isValidationError =
  //       error.message?.includes("Impossible de dimensionner") ||
  //       error.message?.includes("insuffisante");

  //     return sendError(
  //       reply,
  //       isValidationError ? "Erreur de dimensionnement" : "Erreur interne",
  //       isValidationError ? 400 : 500
  //     );
  //   }
  // }

  /**
   * Endpoint de vérification santé des services
   */
  async sante(_request: FastifyRequest, reply: FastifyReply) {
    const data = {
      status: "opérationnel",
      services: {
        bilanConso: "actif",
        parametresSite: "actif",
        puissancePV: "actif",
        stockage: "actif",
        cablageProtections: "actif",
      },
      normesReference: [
        "NF C 15-100",
        "IEC 61215",
        "IEC 62109",
        "NF EN 50549",
        "ISO 8528",
        "IEC 62619",
        "IEC 61643-31",
      ],
      version: "2.0.0",
    };
    return sendSuccess(reply, data, 200);
  }

  /**
   * Endpoint pour récupérer la liste des panneaux photovoltaiques
   */
  async listePanneaux(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();

    try {
      const response = LISTE_PANNEAUX;

      const duration = Date.now() - startTime;
      reply.log.info(`Liste des panneaux solaires rendue en ${duration}ms`);

      return sendSuccess(reply, response, 200);
    } catch (error: any) {
      request.log.error(error);
      return sendError(reply, "Erreur Liste des panneaux", 500);
    }
  }

  /**
   * Endpoint pour récupérer la liste des batteries
   */
  async listeBatteries(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();

    try {
      const response = LISTE_BATTERIES;

      const duration = Date.now() - startTime;
      request.log.info(`Liste des batteries rendue en ${duration}ms`);

      return sendSuccess(reply, response, 200);
    } catch (error: any) {
      request.log.error(error);
      return sendError(reply, "Erreur Liste des Batteries", 500);
    }
  }

  /**
   * Endpoint pour récupérer la liste des panneaux et des batteries en meme temps
   */
  async listes(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();

    try {
      const response = {
        listeBatteries: LISTE_BATTERIES,
        listesPanneaux: LISTE_PANNEAUX,
      };

      const duration = Date.now() - startTime;
      request.log.info(
        `Liste des panneaux et des batteries rendue en ${duration}ms`
      );

      return sendSuccess(reply, response, 200);
    } catch (error: any) {
      request.log.error(error);
      return sendError(reply, "Erreur Liste Panneaux & Batteries", 500);
    }
  }
}

export const installationPhotovoltaiqueController =
  new InstallationPhotovoltaiqueController();
