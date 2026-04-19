import { FastifyRequest, FastifyReply } from "fastify";
import { bilanConsommationService } from "../services/installationPhotovoltaique/bilanConso.services.js";
import { parametresSiteService } from "../services/installationPhotovoltaique/parametreSite.services.js";
import { puissanceCretePVService } from "../services/installationPhotovoltaique/puissancePVCrete.services.js";
import { stockageService } from "../services/installationPhotovoltaique/stockage.services.js";
import { cablageEtProtectionsService } from "../services/installationPhotovoltaique/cablageProtection.services.js";
import type {
    DimensionnementPVRequest,
    DimensionnementPVResponse,
    ResultatStockage
} from "../types/installationPhotovoltaique.types.js";
import { LISTE_PANNEAUX } from "../utils/modulesPVListe.utils.js";
import { LISTE_BATTERIES } from "../utils/batteriesListe.utils.js";

// Contrôleur d'installation photovoltaïque
// Orchestre les services de dimensionnement selon normes NFC 15-100, IEC 61215, etc.

export class InstallationPhotovoltaiqueController {

    /**
     * Endpoint principal de dimensionnement PV complet
     * Enchaîne tous les calculs: consommation, site, modules, onduleur, stockage, câblage
     */
    async dimensionnerInstallation(
        request: FastifyRequest<{ Body: DimensionnementPVRequest }>,
        reply: FastifyReply
    ): Promise<DimensionnementPVResponse | { error: string; message: string; details?: string }> {

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
                tensionSystemeBatterie
            } = request.body;

            // ========== 1. BILAN DE CONSOMMATION ==========
            const energieJournaliere = bilanConsommationService.energieTotal(equipements);
            const puissanceCreteCharge = bilanConsommationService.puissanceTotal(
                equipements,
                facteurFoisonnementGlobal
            );

            if (energieJournaliere <= 0) {
                return reply.code(400).send({
                    error: "Données invalides",
                    message: "L'énergie journalière calculée est nulle ou négative - vérifiez les équipements"
                });
            }

            // ========== 2. PARAMÈTRES SITE ET RESSOURCE SOLAIRE ==========
            const parametresSite = await parametresSiteService.PVGISDatas(localisation);
            const angleOptimal = parametresSiteService.angleOptimal(localisation.lat);

            // ========== 3. PERFORMANCE RATIO ET PERTES ==========
            const { PR, pertesTotales } = await puissanceCretePVService.performanceRatio(
                typeInstallation,
                localisation
            );

            // ========== 4. PUISSANCE CRÊTE PV REQUISE ==========
            const puissanceCretePV = puissanceCretePVService.puissanceCretePV(
                pompageSolaire || false,
                energieJournaliere,
                parametresSite.PSH,
                PR,
                pompageCaracteristiques,
                contraintesOnduleur?.rendementMPPT
            );

            // ========== 5. DIMENSIONNEMENT MODULES PV ==========
            // Détermination contraintes selon type système
            let contraintesOnduleurModules = null;
            let tensionBatt = undefined;

            if (typeSysteme !== "off-grid" && contraintesOnduleur) {
                // On-grid / hybride: contraintes onduleur haute tension
                contraintesOnduleurModules = {
                    tensionMPPTMin: contraintesOnduleur.tensionMPPTMin,
                    tensionMPPTMax: contraintesOnduleur.tensionMPPTMax,
                    tensionDCMax: contraintesOnduleur.tensionDCMax,
                    rendementMPPT: contraintesOnduleur.rendementMPPT
                };
            } else if (typeSysteme === "off-grid") {
                // Off-grid: tension batterie basse tension
                tensionBatt = tensionSystemeBatterie || 48; // 48V par défaut
            }

            const resultatModules = puissanceCretePVService.modulesPV(
                parametresPanneau,
                puissanceCretePV,
                temperaturesAttendue,
                irradianceMax || 1000,
                contraintesOnduleurModules,
                tensionBatt
            );

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
            }

            // ========== 7. DIMENSIONNEMENT STOCKAGE ==========
            let resultatStockage: ResultatStockage | null = null;
            if (typeSysteme !== "on-grid" && autonomieBatterie) {
                const tensionSysteme = typeSysteme === "off-grid"
                    ? (tensionSystemeBatterie || 48)
                    : 400; // Hybride: tension batterie onduleur

                resultatStockage = stockageService.capaciteStockage(
                    technologieBatterie || "LiFePO4",
                    energieJournaliere,
                    autonomieBatterie,
                    tensionSysteme,
                    temperaturesAttendue.temperatureMax
                );

                // Disposition modules batterie
                const tensionUnitaire = technologieBatterie === "LiFePO4" ? 12.8 : 12.0; // V
                const capaciteUnitaire = 200; // Ah - à paramétrer

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
                        ? puissanceCreteCharge / resultatOnduleur.dimensionnement.puissanceACRecommandee
                        : 0.95
                );
                (resultatStockage as any).bms = bms;
            }

            // ========== 8. DIMENSIONNEMENT CÂBLAGE ET PROTECTIONS ==========
            const materiau = cablage?.materiau || "cuivre";
            const conditionEnv = cablage?.conditionEnvironnement || "chaud";

            const dimensionnementCablage = cablageEtProtectionsService.dimensionnerCablesDC(
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
                const puissanceAC = resultatOnduleur.dimensionnement.puissanceACRecommandee;
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
            }

            // ========== 9. ASSEMBLAGE RÉPONSE ==========
            const chuteTensionGlobaleDC = dimensionnementCablage.cablesString[0] ?
                dimensionnementCablage.cablesString[0].chuteTensionPourcent +
                dimensionnementCablage.cablePrincipalDC.chuteTensionPourcent : 3;

            const response: DimensionnementPVResponse = {
                resume: {
                    energieJournaliere_Wh: Math.round(energieJournaliere),
                    puissanceCreteCharge_W: Math.round(puissanceCreteCharge),
                    puissanceCretePV_Wc: Math.round(puissanceCretePV),
                    ratioDCAC: resultatOnduleur?.dimensionnement.ratioDCAC,
                    surfaceEstimee_m2: resultatModules.totalPanneaux * 2.0, // ~2m² par panneau standard
                    nombreStrings: resultatModules.stringsEnParallele
                },
                site: {
                    localisation,
                    angleOptimal,
                    PSH_moisDefavorable: parametresSite.PSH,
                    performanceRatio: Math.round(PR * 1000) / 1000,
                    pertesTotales_pourcent: pertesTotales
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
                        "IEC 61643-31"
                    ],
                    verificationVoc: resultatOnduleur?.verification?.details?.vocSousLimite ??
                        (resultatModules.vocStringFroid < (contraintesOnduleur?.tensionDCMax || Infinity)),
                    verificationMPPT: resultatOnduleur?.verification?.details?.vmppDansPlageMPPT ?? true,
                    verificationIsc: resultatOnduleur?.verification?.details?.iscSousLimite ?? true,
                    verificationChuteTension: chuteTensionGlobaleDC <= 3.0 &&
                        (dimensionnementAC ? dimensionnementAC.chuteTension <= 5.0 : true),
                    avertissements: [
                        ...(resultatOnduleur?.avertissements || []),
                        ...dimensionnementCablage.avertissements
                    ],
                    erreurs: resultatOnduleur?.erreurs || []
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    versionCalculateur: "2.0.0-normes2024"
                }
            };

            const duration = Date.now() - startTime;
            request.log.info(`Dimensionnement PV complété en ${duration}ms`);

            return reply.code(200).send(response);

        } catch (error: any) {
            request.log.error(error);

            // Classification erreurs
            const isValidationError = error.message.includes("Impossible de dimensionner") ||
                error.message.includes("insuffisante");

            return reply.code(isValidationError ? 400 : 500).send({
                error: isValidationError ? "Erreur de dimensionnement" : "Erreur interne",
                message: error.message,
                details: process.env.NODE_ENV === "development" ? error.stack : undefined
            });
        }
    }

    /**
     * Endpoint de vérification santé des services
     */
    async sante(request: FastifyRequest, reply: FastifyReply) {
        return {
            status: "opérationnel",
            services: {
                bilanConso: "actif",
                parametresSite: "actif",
                puissancePV: "actif",
                stockage: "actif",
                cablageProtections: "actif"
            },
            normesReference: [
                "NF C 15-100",
                "IEC 61215",
                "IEC 62109",
                "NF EN 50549",
                "ISO 8528",
                "IEC 62619",
                "IEC 61643-31"
            ],
            version: "2.0.0"
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
                details: process.env.NODE_ENV === "development" ? error.stack : undefined
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
                details: process.env.NODE_ENV === "development" ? error.stack : undefined
            });
        }
    }
}

export const installationPhotovoltaiqueController = new InstallationPhotovoltaiqueController();