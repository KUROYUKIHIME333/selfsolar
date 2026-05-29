import { FastifyRequest, FastifyReply } from "fastify";
import { bilanConsommationService } from "../services/installationPhotovoltaique/bilanConso.services.js";
import { parametresSiteService } from "../services/installationPhotovoltaique/parametreSite.services.js";
import { puissanceCretePVService } from "../services/installationPhotovoltaique/puissancePVCrete.services.js";
import { stockageService } from "../services/installationPhotovoltaique/stockage.services.js";
import { cablageEtProtectionsService } from "../services/installationPhotovoltaique/cablageProtection.services.js";
import type {
  DimensionnementPVRequest,
  DimensionnementPVResponse,
  ResultatStockage,
  Equipement,
  Localisation,
  ParametresSTCPanneau,
  TypeInstallationPourPertes,
  TypeSystemePV,
  TechnologieBatterie,
  MateriauConducteur,
  MethodePose,
  PompageSolaireCaracteristiques,
  TemperaturesMinMax,
  ConfigurationTension,
} from "../types/installationPhotovoltaique.types.js";
import { TypeInstallationPourPertesArray } from "../types/installationPhotovoltaique.types.js";
import { LISTE_PANNEAUX } from "../utils/modulesPVListe.utils.js";
import { LISTE_BATTERIES } from "../utils/batteriesListe.utils.js";
import { controllerErrorHandler } from "../utils/gestionErreur.utils.js";
import { CONFIG_TECHNOLOGIES } from "../utils/constantesPhysiques.utils.js";
import { success } from "zod/v4";

const TARGET_YEAR_IN_FUTURE: number = 40;

// Contrôleur d'installation photovoltaïque
// Orchestre les services de dimensionnement selon normes NFC 15-100, IEC 61215, etc.
export class InstallationPhotovoltaiqueController {
  /**
   * Analyse la consommation électrique des équipements
   */
  analyserConsommation(request: FastifyRequest, reply: FastifyReply) {
    const { equipements, kfGlobal } = request.body;
    let response;

    try {
      
      if (
        !equipements ||
        !Array.isArray(equipements) ||
        equipements.length === 0
      ) {
        response = {
          success: false,
          error: "La liste des équipements est vide ou invalide.",
          data: null,
        };
      }

      if (kfGlobal !== undefined && (kfGlobal <= 0 || kfGlobal > 1)) {
        response = {
          success: false,
          error:
            "Le coefficient de simultanéité global (kfGlobal) doit être compris entre 0 et 1.",
          data: null,
        };
      }

      const energieJournaliereTotal =
        bilanConsommationService.energieTotal(equipements);

      const puissanceAppeleeMax = bilanConsommationService.puissanceAppelee(
        equipements,
        kfGlobal ?? 0.8
      );

      const puissanceInstalleeTotal =
        bilanConsommationService.puissanceInstaleeAC(equipements);

      const puissancePicDemarrage =
        bilanConsommationService.puissancePic(equipements);

      response = {
        success: true,
        error: null,
        datas: {
          energieJournaliereWh: energieJournaliereTotal,
          puissanceAppeleeW: puissanceAppeleeMax,
          puissanceInstalleeW: puissanceInstalleeTotal,
          puissancePicW: puissancePicDemarrage,
        },
      };
    } catch (error: unknown) {
      response = controllerErrorHandler(error, "[Analyse Conso]");

    }
  }
  /**
   * Analyse des données météorologiques
   * Elles sont récupérées de PVGIS (voir parametreSite.services.ts)
   */
  async analyserGeographie(localisation: Localisation) {
    try {
      if (!localisation || !localisation.lat || !localisation.long) {
        return {
          success: false,
          error:
            "La localisation du site doit etre au format {lat: number; long: number; altitude: number | undefined}",
          data: null,
        };
      }

      if (localisation.lat < -90 || localisation.lat > 90) {
        return {
          success: false,
          error: "La latitude est comprise entre -90 et 90",
          data: null,
        };
      }

      if (localisation.long < -180 || localisation.long > 180) {
        return {
          success: false,
          error: "La longitude est comprise entre -180 et 180",
          data: null,
        };
      }

      const targetYear = new Date().getFullYear() + TARGET_YEAR_IN_FUTURE;
      // Calcul de l'inclinaison optimale basée sur la latitude
      const orientationEtAngle = parametresSiteService.angleOptimal(
        localisation.lat
      );

      const { angleOptimalPVGIS, ...leReste } =
        await parametresSiteService.PVGISDatas(localisation, targetYear);

      return {
        success: true,
        error: null,
        data: {
          localisation: localisation,
          orientation: orientationEtAngle.orientation,
          angle: orientationEtAngle.angle,
          angleOptimal: angleOptimalPVGIS,
          ...leReste,
        },
      };
    } catch (error: unknown) {
      return controllerErrorHandler(error, "[Analyse Geographique]");
    }
  }
  /**
   * Obtention de la capacité du bloc batteries
   * Si besoin
   */
  etablirStockage(
    technologie: TechnologieBatterie,
    consommationJournaliere: number,
    autonomie: number,
    tensionSysteme: number,
    temperatureAmbiante?: number | undefined
  ) {
    try {
      if (!technologie) {
        return {
          success: false,
          error:
            "Renseigner le type de batterie (Plomb-acide, AGM/Gel, LiFePO4, Lithium NMC/NCA ou NiCd)",
          data: null,
        };
      }
      if (!consommationJournaliere || !autonomie || !tensionSysteme) {
        return {
          success: false,
          error:
            "Pour calculer la capacité du stockage, il faut la consommation journalière (Ec), le nombre de jours d'autonomie (N) et la tension du système (Us)",
          data: null,
        };
      }

      const stockageCalcule = stockageService.capaciteStockage(
        technologie,
        consommationJournaliere,
        autonomie,
        tensionSysteme,
        temperatureAmbiante
      );

      return {
        success: true,
        error: null,
        data: stockageCalcule,
      };
    } catch (error: unknown) {
      return controllerErrorHandler(error, "[Determiner batteries]");
    }
  }
  /**
   * Obtention de la puissance crète et des pertes
   */
  etablirPuissanceCrete(
    typeInstallation: TypeInstallationPourPertes,
    pompageSolaire: boolean,
    energieCrete: number | undefined, // Wh/j (Ignoré si pompageSolaire = true)
    PSH: number, // h/j (Heures d'ensoleillement équivalentes à 1000W/m²)
    stockage: boolean,
    pompageCaracteristiques?: PompageSolaireCaracteristiques,
    rendementOnduleurMTTP?: number | undefined,
    technologieBatteries?: TechnologieBatterie | undefined
  ) {
    try {
      // Verifier si typeInstallation est bien une des valeurs possible du type TypeInstallationPourPertes (dans le tableaux TypeInstallationPourPertesArray)
      const typeTypeInstallation: boolean =
        TypeInstallationPourPertesArray.includes(typeInstallation);
      // Autres validations
      if (!PSH) {
        return {
          success: false,
          error:
            "PSH (Heures d'ensoleillement équivalentes à 1000W/m²) doit être renseigné",
          data: null,
        };
      }
      if (!typeInstallation || !typeTypeInstallation) {
        return {
          success: false,
          error:
            "Le type d'installation doit être choisi. Choix possibles: HAUTE_QUALITE, STANDARD, POUSSIEREUX, FAIBLE_MAINTENANCE, ANCIEN ou CABLE_LONG",
          data: null,
        };
      }
      if (
        (!pompageSolaire && !energieCrete) ||
        (pompageSolaire && energieCrete)
      ) {
        return {
          success: false,
          error:
            "S'il s'agit d'une installation de pompage solaire, renseigner ses caractéristiques. S'il n'en est rien, renseigner les equipements. Ne pas mélanger les 2",
          data: null,
        };
      }

      const { pertesTotales, PR } =
        puissanceCretePVService.performanceRatio(typeInstallation);

      let Ec = energieCrete;

      if (stockage && technologieBatteries && energieCrete) {
        const K =
          CONFIG_TECHNOLOGIES[technologieBatteries]["facteurMajorationCharge"];
        Ec = energieCrete * K;
      }

      const {
        success: PcSuccess,
        puissanceCrete: PcValue,
        error: PcError,
      } = puissanceCretePVService.puissanceCretePV(
        pompageSolaire,
        Ec,
        PSH,
        PR,
        pompageCaracteristiques,
        rendementOnduleurMTTP
      );

      if (!PcSuccess || PcError) {
        return {
          success: true,
          error: PcError,
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data: {
          Pc: PcValue,
          pertesTotales: pertesTotales,
        },
      };
    } catch (error: unknown) {
      return controllerErrorHandler(error, "[Puissance crete calculs]");
    }
  }

  dimensionnerModulesPV(
    panneauParametres: ParametresSTCPanneau,
    puissanceCretePV: number,
    temperaturesAttendue: TemperaturesMinMax,
    irradianceMax: number,
    tensionSystem: number,
    configurationSystem: ConfigurationTension
  ) {
    try {
      if (!panneauParametres || !puissanceCretePV) {
        return {
          success: false,
          error:
            "Les paramètres du module (puissanceCreteModule, tensionMPP, tensionVoc, courantMPP, courantCourtCircuit, coeffTempTension, coeffTempPuissance et noct, aussi coeffTempCourant si donné, mais pas obligé) ainsi que la puissnace crète calculée du champs doivent être renseignées",
          data: null,
        };
      }
      if (!temperaturesAttendue || !irradianceMax) {
        return {
          success: false,
          error:
            "Les temperatures (temperatureMin et temperatureMax) ainsi que l'irradiance maximum doivent être renseignées",
          data: null,
        };
      }
      if (!tensionSystem || !configurationSystem) {
        return {
          success: false,
          error:
            "La tension du système (en Courant continue) doit être renseignées",
          data: null,
        };
      }

      const {
        success: modulesPVsuccess,
        data: modulesPVdata,
        error: modulesPVerror,
      } = puissanceCretePVService.modulesPV(
        panneauParametres,
        puissanceCretePV,
        temperaturesAttendue,
        irradianceMax,
        tensionSystem,
        configurationSystem
      );

      if (!modulesPVsuccess || modulesPVerror) {
        return {
          success: false,
          error: modulesPVerror,
          data: null,
        };
      }

      return {
        success: true,
        error: null,
        data: modulesPVdata,
      };
    } catch (error: unknown) {
      return controllerErrorHandler(error, "[nombres de panneaux]");
    }
  }

  dimensionnerModulesBatteries(
    tensionSystem: number,
    tensionBatterie: number,
    capaciteBatterie: number,
    capaciteTotal: number
  ) {
    try {
      
    } catch (error) {
      
    }
  }

  dimensionnerOnduleur() {}

  // denombrerPanneaux(
  //   panneauParametres: ParametresSTCPanneau,
  //       puissanceCretePV: number,
  //       temperaturesAttendue: TemperaturesMinMax,
  //       irradianceMax: number,
  //       tensionSystem?: number,
  //       configurationSystem?: ConfigurationTension
  // ){}

  /**
   * Endpoint principal de dimensionnement PV complet
   * Enchaîne tous les calculs: consommation, site, modules, onduleur, stockage, câblage
   */
  async dimensionnerInstallation(
    request: FastifyRequest<{ Body: DimensionnementPVRequest }>,
    reply: FastifyReply
  ): Promise<
    | DimensionnementPVResponse
    | { error: string; message: string; details?: string }
  > {
    const startTime = Date.now();

    try {
      const {
        localisation,
        equipements,
        typeInstallation,
        typeSysteme,
        parametresPanneau,
        temperaturesAttendue,
        autonomieBatterie,
        technologieBatterie,
        contraintesOnduleur,
        cablage,
        pompageSolaire,
        pompageCaracteristiques,
        irradianceMax,
        facteurFoisonnementGlobal,
        tensionSystemeBatterie,
        modeleBatterie,
      } = request.body;

      // ========== 1. BILAN DE CONSOMMATION ==========
      const energieJournaliere =
        bilanConsommationService.energieTotal(equipements);
      const puissanceCreteCharge = bilanConsommationService.puissanceAppelee(
        equipements,
        facteurFoisonnementGlobal
      );

      if (energieJournaliere <= 0) {
        return reply.code(400).send({
          error: "Données invalides",
          message:
            "L'énergie journalière calculée est nulle ou négative - vérifiez les équipements ou les données entrées",
        });
      }

      console.log("L'Ec", energieJournaliere); //WARNING: To remove after tests

      // ========== 2. PARAMÈTRES SITE ET RESSOURCE SOLAIRE ==========
      const parametresSite = await parametresSiteService.PVGISDatas(
        localisation
      );
      const angleOptimal = parametresSiteService.angleOptimal(localisation.lat);

      console.log("L'angle optimal et tout' :", JSON.stringify(angleOptimal)); //WARNING: To remove after tests
      console.log("L'angle optimal et tout' :", angleOptimal); //WARNING: To remove after tests

      // ========== 3. PERFORMANCE RATIO ET PERTES ==========
      const { PR, pertesTotales } =
        await puissanceCretePVService.performanceRatio(
          typeInstallation,
          localisation
        );

      console.log(
        "Le ratio de performance calculée :",
        PR,
        " mais avec des pertes ",
        pertesTotales
      ); //WARNING: To remove after tests

      // ========== 4. PUISSANCE CRÊTE PV REQUISE ==========
      const puissanceCretePV = puissanceCretePVService.puissanceCretePV(
        pompageSolaire || false,
        energieJournaliere,
        parametresSite.G_moy,
        PR,
        pompageCaracteristiques,
        contraintesOnduleur?.rendementMPPT
      );

      console.log(pompageCaracteristiques);
      console.log("La puisance crète calculée :", puissanceCreteCharge); //WARNING: To remove after tests

      // ========== 5. DIMENSIONNEMENT MODULES PV ==========
      // Détermination contraintes selon type système
      let contraintesOnduleurModules = null;
      let tensionBatt = 24;
      let tensionConventionnelleSys = 48;

      if (typeSysteme !== "off-grid" && contraintesOnduleur) {
        // On-grid / hybride: contraintes onduleur haute tension
        contraintesOnduleurModules = {
          tensionMPPTMin: contraintesOnduleur.tensionMPPTMin,
          tensionMPPTMax: contraintesOnduleur.tensionMPPTMax,
          tensionDCMax: contraintesOnduleur.tensionDCMax,
          rendementMPPT: contraintesOnduleur.rendementMPPT,
        };
      } else if (typeSysteme === "off-grid") {
        if (puissanceCretePV < PALIERS_PC_BAS_TENSION8SYSTEME_PV) {
          tensionConventionnelleSys = 12;
        } else if (
          puissanceCretePV > PALIERS_PC_BAS_TENSION8SYSTEME_PV &&
          puissanceCretePV < PALIERS_PC_BAS_TENSION8SYSTEME_PV * 4
        ) {
          tensionConventionnelleSys = 24;
        } else if (puissanceCretePV > PALIERS_PC_BAS_TENSION8SYSTEME_PV * 20) {
          tensionConventionnelleSys = 96;
        }
        // Off-grid: tension batterie basse tension
        tensionBatt = tensionSystemeBatterie
          ? tensionSystemeBatterie
          : tensionConventionnelleSys;
      }

      const resultatModules = puissanceCretePVService.modulesPV(
        parametresPanneau,
        puissanceCretePV,
        temperaturesAttendue,
        parametresSite.G_moy,
        parametresSite.G_max,
        tensionBatt,
        contraintesOnduleurModules
      );

      console.log("Verification des modules : ", resultatModules);

      // ========== 6. VÉRIFICATION ONDULEUR ==========
      let resultatOnduleur = null;
      if (contraintesOnduleur) {
        resultatOnduleur = puissanceCretePVService.onduleur(
          resultatModules,
          parametresPanneau,
          temperaturesAttendue,
          irradianceMax || 1000,
          typeSysteme,
          puissanceCreteCharge,
          contraintesOnduleur,
          puissanceCreteCharge * 1.5 // Estimation puissance démarrage
        );

        console.log("L'onduleur testé:", resultatOnduleur); //WARNING: To remove after tests
      }

      // ========== 7. DIMENSIONNEMENT STOCKAGE ==========
      let resultatStockage: ResultatStockage | null = null;
      if (modeleBatterie) {
        if (typeSysteme !== "on-grid" && autonomieBatterie) {
          const tensionSysteme =
            typeSysteme === "off-grid"
              ? tensionSystemeBatterie || tensionConventionnelleSys
              : 400; // Hybride: tension batterie onduleur

          resultatStockage = stockageService.capaciteStockage(
            technologieBatterie || "LiFePO4",
            energieJournaliere,
            autonomieBatterie,
            tensionSysteme,
            temperaturesAttendue.temperatureMax
          );

          // Disposition modules batterie
          const tensionUnitaire = modeleBatterie.v; // V
          const capaciteUnitaire = modeleBatterie.ah; // Ah - à paramétrer

          const dispositionBatt = stockageService.modulesBatteries(
            tensionSysteme,
            tensionUnitaire,
            capaciteUnitaire,
            resultatStockage?.capacite.nominale_Ah
          );

          // Fusion avec résultat stockage
          (resultatStockage as any).disposition = dispositionBatt;

          // Dimensionnement BMS
          const bms = stockageService.regulateurBMS(
            puissanceCretePV,
            tensionSysteme,
            puissanceCreteCharge,
            resultatOnduleur?.dimensionnement.puissanceACRecommandee
              ? puissanceCreteCharge /
                  resultatOnduleur.dimensionnement.puissanceACRecommandee
              : 0.95
          );
          (resultatStockage as any).bms = bms;
        }

        console.log("Les batteries:", resultatStockage); //WARNING: To remove after tests
      }

      // ========== 8. DIMENSIONNEMENT CÂBLAGE ET PROTECTIONS ==========
      const materiau = cablage?.materiau || "cuivre";
      const conditionEnv = cablage?.conditionEnvironnement || "chaud";

      const dimensionnementCablage =
        cablageEtProtectionsService.dimensionnerCablesDC(
          resultatModules,
          parametresPanneau,
          cablage?.longueurString || 15,
          cablage?.longueurPrincipalDC || 10,
          temperaturesAttendue.temperatureMax,
          resultatModules.stringsEnParallele,
          materiau,
          cablage?.methodePoseDC || "conduit_surface",
          conditionEnv
        );

      // Câblage AC si onduleur présent
      let dimensionnementAC = null;
      if (resultatOnduleur) {
        const puissanceAC =
          resultatOnduleur.dimensionnement.puissanceACRecommandee;
        const tensionAC = puissanceAC > 5000 ? 400 : 230; // Triphasé si > 5kW

        dimensionnementAC = cablageEtProtectionsService.dimensionnerCablageAC(
          puissanceAC,
          tensionAC,
          0.95, // cosφ onduleur
          cablage?.longueurAC || 20,
          "mixte",
          30,
          cablage?.methodePoseAC || "conduit_encastre",
          materiau
        );

        dimensionnementCablage.cablageAC = dimensionnementAC;

        console.log("Les cables :", dimensionnementCablage); //WARNING: To remove after tests
      }

      // ========== 9. ASSEMBLAGE RÉPONSE ==========
      const chuteTensionGlobaleDC = dimensionnementCablage.cablesString[0]
        ? dimensionnementCablage.cablesString[0].chuteTensionPourcent +
          dimensionnementCablage.cablePrincipalDC.chuteTensionPourcent
        : 3;

      const response: DimensionnementPVResponse = {
        resume: {
          energieJournaliere_Wh: Math.round(energieJournaliere),
          puissanceCreteCharge_W: Math.round(puissanceCreteCharge),
          puissanceCretePV_Wc: Math.round(puissanceCretePV),
          ratioDCAC: resultatOnduleur?.dimensionnement.ratioDCAC,
          surfaceEstimee_m2: resultatModules.totalPanneaux * 2.0, // ~2m² par panneau standard
          nombreStrings: resultatModules.stringsEnParallele,
        },
        site: {
          localisation,
          angleOptimal,
          PSH_moisDefavorable: parametresSite.PSH,
          performanceRatio: Math.round(PR * 1000) / 1000,
          pertesTotales_pourcent: pertesTotales,
        },
        modulesPV: resultatModules,
        onduleur: resultatOnduleur,
        stockage: resultatStockage,
        cablage: dimensionnementCablage,
        conformite: {
          normesReference: [
            "NF C 15-100",
            "IEC 61215",
            "IEC 62109",
            "NF EN 50549",
            "IEC 62619",
            "IEC 61643-31",
          ],
          verificationVoc:
            resultatOnduleur?.verification?.details?.vocSousLimite ??
            resultatModules.vocStringFroid <
              (contraintesOnduleur?.tensionDCMax || Infinity),
          verificationMPPT:
            resultatOnduleur?.verification?.details?.vmppDansPlageMPPT ?? true,
          verificationIsc:
            resultatOnduleur?.verification?.details?.iscSousLimite ?? true,
          verificationChuteTension:
            chuteTensionGlobaleDC <= 3.0 &&
            (dimensionnementAC ? dimensionnementAC.chuteTension <= 5.0 : true),
          avertissements: [
            ...(resultatOnduleur?.avertissements || []),
            ...dimensionnementCablage.avertissements,
          ],
          erreurs: resultatOnduleur?.erreurs || [],
        },
        meta: {
          timestamp: new Date().toISOString(),
          versionCalculateur: "2.0.0-normes2024",
        },
      };

      const duration = Date.now() - startTime;
      request.log.info(`Dimensionnement PV complété en ${duration}ms`);

      return reply.code(200).send(response);
    } catch (error: any) {
      request.log.error(error);

      // Classification erreurs
      const isValidationError =
        error.message.includes("Impossible de dimensionner") ||
        error.message.includes("insuffisante");

      return reply.code(isValidationError ? 400 : 500).send({
        error: isValidationError
          ? "Erreur de dimensionnement"
          : "Erreur interne",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  /**
   * Endpoint de vérification santé des services
   */
  async sante() {
    return {
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
  }

  /**
   *  Endpoint pour récupérer la liste des panneaux photovoltaiques
   */
  async listePanneaux(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();

    try {
      const response = LISTE_PANNEAUX;

      const duration = Date.now() - startTime;
      reply.log.info(`Liste des panneaux solaires rendue en ${duration}ms`);

      return reply.code(200).send(response);
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Erreur Liste des panneaux",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  /**
   *  Endpoint pour récupérer la liste des batteries
   */
  async listeBatteries(request: FastifyRequest, reply: FastifyReply) {
    const startTime = Date.now();

    try {
      const response = LISTE_BATTERIES;

      const duration = Date.now() - startTime;
      request.log.info(`Liste des batteries rendue en ${duration}ms`);

      return reply.code(200).send(response);
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Erreur Liste des Batteries",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  /**
   *  Endpoint pour récupérer la liste des panneaux et des batteries en meme temps
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

      return reply.code(200).send(response);
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Erreur Liste Panneaux & Batteries",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
}

export const installationPhotovoltaiqueController =
  new InstallationPhotovoltaiqueController();
