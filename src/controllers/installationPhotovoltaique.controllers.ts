import { FastifyRequest, FastifyReply } from "fastify";
import { bilanConsommationService } from "../services/installationPhotovoltaique/bilanConso.services.js";
import { parametresSiteService } from "../services/installationPhotovoltaique/parametreSite.services.js";
import { puissanceCretePVService } from "../services/installationPhotovoltaique/puissancePVCrete.services.js";
import { stockageService } from "../services/installationPhotovoltaique/stockage.services.js";
import { cablageEtProtectionsService } from "../services/installationPhotovoltaique/cablageProtection.services.js";
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
  MateriauConducteur,
  MethodePose,
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
  public async analyserConsommation(
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

      const {
        success: successEc,
        error: errorEc,
        data: energieJournaliereTotal,
      } = bilanConsommationService.energieTotal(equipements);

      const {
        success: successPam,
        error: errorPam,
        data: puissanceAppeleeMax,
      } = bilanConsommationService.puissanceAppelee(
        equipements,
        facteurFoisonnementGlobal ?? 0.8
      );

      const {
        success: successPia,
        error: errorPia,
        data: puissanceInstalleeTotal,
      } = bilanConsommationService.puissanceInstaleeAC(equipements);
      bilanConsommationService.puissanceInstaleeAC(equipements);

      const {
        success: successPp,
        error: errorPp,
        data: puissancePicDemarrage,
      } = bilanConsommationService.puissancePic(equipements);
      bilanConsommationService.puissancePic(equipements);

      if (
        !successEc ||
        !successPam ||
        !successPia ||
        !successPp ||
        errorEc ||
        errorPam ||
        errorPia ||
        errorPp ||
        !energieJournaliereTotal ||
        !puissanceAppeleeMax ||
        !puissanceInstalleeTotal ||
        !puissancePicDemarrage
      ) {
        return sendError(
          reply,
          errorEc ||
            errorPam ||
            errorPia ||
            errorPp ||
            "Une erreur est survenue lors de l'analyse de la consommation",
          400
        );
      }

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
  public async analyserGeographie(
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
  public async etablirStockage(
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

      const {
        success: stockageSuccess,
        error: stockageError,
        data: stockageCalcule,
      } = stockageService.capaciteStockage(
        technologieBattery,
        energieJournaliere_Wh,
        autonomieBatterie_jours,
        tensionSystemeBatterie_V,
        temperatureAmbiante_C
      );

      if (!stockageSuccess && stockageError) {
        return sendError(reply, stockageError, 400);
      }

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
  public async etablirPuissanceCrete(
    request: FastifyRequest<{
      Body: {
        typeInstallation: TypeInstallationPourPertes;
        pompageSolaire: boolean;
        PSH_heuresParJour: number;
        avecStockage: boolean;
        energieCrete_Wh?: number;
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

      const {
        success: PrSuccess,
        error: PrError,
        data: PrData,
      } = puissanceCretePVService.performanceRatio(typeInstallation);

      if (
        !PrData ||
        !PrSuccess ||
        PrError ||
        typeof PrData?.PR !== "number" ||
        typeof PrData?.pertesTotales !== "number"
      ) {
        return sendError(
          reply,
          PrError ||
            "Un probleme est survenu pour avoir le Ratio de perfornance",
          400
        );
      }

      let Ec = energieCrete_Wh;

      if (avecStockage && technologieBatteries && energieCrete_Wh) {
        const K =
          CONFIG_TECHNOLOGIES[technologieBatteries]["facteurMajorationCharge"];
        Ec = energieCrete_Wh * K;
      }

      const {
        success: PcSuccess,
        data: PcValue,
        error: PcError,
      } = puissanceCretePVService.puissanceCretePV(
        pompageSolaire,
        Ec,
        PSH_heuresParJour,
        PrData.PR,
        pompageCaracteristiques,
        rendementOnduleurMPPT
      );

      if (!PcSuccess || PcError) {
        return sendError(reply, PcError, 400);
      }

      return sendSuccess(
        reply,
        {
          Pc: PcValue?.puissanceCrete,
          pertesTotales: PrData.pertesTotales,
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
  public async dimensionnerModulesPV(
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
  public async dimensionnerModulesBatteries(
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

      const {
        success: dispositionBattSuccess,
        data: dispositionBatt,
        error: dispositionBattError,
      } = stockageService.modulesBatteries(
        tensionSysteme_V,
        tensionUnitaireBatterie_V,
        capaciteUnitaireBatterie_Ah,
        capaciteTotaleRequise_Ah
      );

      if (!dispositionBattSuccess && dispositionBattError) {
        return sendError(reply, dispositionBattError, 400);
      }

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
  public async dimensionnerOnduleur(
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

      const {
        success: OnduleurSuccess,
        data: OnduleurData,
        error: OnduleurError,
      } = puissanceCretePVService.onduleur(
        resultats_modules,
        parametres_panneaux,
        irradiance_max,
        typeSysteme,
        puissance_chargeContinue,
        onduleur_propose,
        puissance_demarrage
      );

      if (!OnduleurSuccess && OnduleurError) {
        return sendError(reply, OnduleurError, 400);
      }

      return sendSuccess(reply, OnduleurData, 200);
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
   * Dimensionner les cables
   * Choisir les protections
   */
  public async dimensionnerCablesEtProtections(
    request: FastifyRequest<{
      Body: {
        resultatModules: ResultatModulesPV;
        Parametres_panneau: ParametresSTCPanneau;
        longueur_cable_String_m: number;
        longueur_cable_principal_m: number;
        temperatureAmbiante: number;
        materiau_conducteur_AC: MateriauConducteur;
        materiau_conducteur_DC: MateriauConducteur;
        puissance_nominale_onduleur_Wh: number;
        tension_Reseau_V: number;
        is_Triphase: boolean;
        longueur_Meters: number;
        cosPhi: number;
        methodePose: MethodePose;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const {
        resultatModules,
        Parametres_panneau,
        longueur_cable_String_m,
        longueur_cable_principal_m,
        temperatureAmbiante,
        materiau_conducteur_DC,
        materiau_conducteur_AC,
        puissance_nominale_onduleur_Wh,
        tension_Reseau_V,
        is_Triphase,
        longueur_Meters,
        cosPhi,
        methodePose,
      } = request.body;

      // 1. Validation rapide des données requises
      if (!resultatModules || !Parametres_panneau) {
        return sendError(
          reply,
          "Les résultats des modules PV et les caractéristiques des panneaux STC sont obligatoires.",
          400
        );
      }

      if (!puissance_nominale_onduleur_Wh || !tension_Reseau_V) {
        return sendError(
          reply,
          "La puissance nominale de l'onduleur et la tension réseau AC sont obligatoires.",
          400
        );
      }

      // 2. Calcul de la partie DC (Strings & Câble principal PV)
      const resDC = cablageEtProtectionsService.dimensionnerCablesDC(
        resultatModules,
        Parametres_panneau,
        longueur_cable_String_m ?? 15,
        longueur_cable_principal_m ?? 10,
        temperatureAmbiante ?? 30,
        materiau_conducteur_DC ?? "cuivre"
      );

      if (!resDC.success || !resDC.data) {
        return sendError(
          reply,
          resDC.error || "Erreur lors du dimensionnement des câbles DC.",
          400
        );
      }

      // 3. Calcul de la partie AC (Onduleur -> Réseau)
      const resAC = cablageEtProtectionsService.dimensionnerCablageAC(
        puissance_nominale_onduleur_Wh,
        tension_Reseau_V,
        is_Triphase ?? false,
        longueur_Meters ?? 10,
        cosPhi ?? 0.8,
        temperatureAmbiante ?? 30,
        materiau_conducteur_AC ?? "cuivre",
        methodePose ?? "conduit_encastre"
      );

      if (!resAC.success || !resAC.data) {
        return sendError(
          reply,
          resAC.error || "Erreur lors du dimensionnement du câblage AC.",
          400
        );
      }

      // 4. Fusion des résultats pour une réponse complète
      const reponseGlobale = {
        dimensionnementDC: resDC.data,
        dimensionnementAC: resAC.data,
        normesAppliquees: {
          dc: "Guide UTE C 15-712-1 / IEC 60364",
          ac: "NF C 15-100",
        },
      };

      return sendSuccess(reply, reponseGlobale, 200);
    } catch (error) {
      request.log.error(error);
      return sendError(
        reply,
        controllerErrorHandler(error, "[Cables & Protections ]"),
        500
      );
    }
  }

  /**
   * Endpoint de vérification santé des services
   */
  public async sante(_request: FastifyRequest, reply: FastifyReply) {
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
  public async listePanneaux(request: FastifyRequest, reply: FastifyReply) {
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
  public async listeBatteries(request: FastifyRequest, reply: FastifyReply) {
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
  public async listes(request: FastifyRequest, reply: FastifyReply) {
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
