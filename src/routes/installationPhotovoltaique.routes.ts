import { FastifyInstance } from "fastify";
import { installationPhotovoltaiqueController } from "../controllers/installationPhotovoltaique.controllers.js";

// Routes API pour le dimensionnement photovoltaïque
// Base: /api/v1/pv/*

export const installationPhotovoltaiqueRoutes = async (app: FastifyInstance) => {

    // ========== ROUTE PRINCIPALE: DIMENSIONNEMENT COMPLET ==========
    app.post("/dimensionner", {
        schema: {
            description: "Dimensionnement complet installation photovoltaïque selon normes NFC 15-100, IEC 61215",
            tags: ["photovoltaique", "dimensionnement"],
            summary: "Calcule la configuration optimale d'une installation PV",
            body: {
                type: "object",
                required: [
                    "localisation",
                    "equipements",
                    "typeInstallation",
                    "typeSysteme",
                    "parametresPanneau",
                    "temperaturesAttendue"
                ],
                properties: {
                    // Localisation
                    localisation: {
                        type: "object",
                        description: "Coordonnées géographiques du site",
                        properties: {
                            lat: {
                                type: "number",
                                minimum: -90,
                                maximum: 90,
                                description: "Latitude en degrés décimaux"
                            },
                            long: {
                                type: "number",
                                minimum: -180,
                                maximum: 180,
                                description: "Longitude en degrés décimaux"
                            },
                            altitude: {
                                type: "number",
                                description: "Altitude en mètres (pour déclassement)"
                            }
                        },
                        required: ["lat", "long"]
                    },

                    // Consommation
                    equipements: {
                        type: "array",
                        description: "Inventaire des équipements électriques",
                        items: {
                            type: "object",
                            properties: {
                                nom: {
                                    type: "string",
                                    description: "Nom de l'équipement"
                                },
                                P: {
                                    type: "number",
                                    minimum: 0,
                                    description: "Puissance nominale (W)"
                                },
                                h: {
                                    type: "number",
                                    minimum: 0,
                                    maximum: 24,
                                    description: "Durée d'utilisation journalière (h/j)"
                                },
                                ks: {
                                    type: "number",
                                    minimum: 0,
                                    maximum: 1,
                                    description: "Facteur de simultanéité (0-1)"
                                }
                            },
                            required: ["P", "h", "ks"]
                        }
                    },
                    facteurFoisonnementGlobal: {
                        type: "number",
                        minimum: 0.5,
                        maximum: 1.0,
                        default: 0.8,
                        description: "Kf - Facteur de foisonnement global entre usages"
                    },

                    // Configuration système
                    typeInstallation: {
                        type: "string",
                        enum: ["HAUTE_QUALITE", "STANDARD", "POUSSIEREUX", "FAIBLE_MAINTENANCE", "ANCIEN", "CABLE_LONG"],
                        description: "Qualité et conditions de l'installation (impacte PR)"
                    },
                    typeSysteme: {
                        type: "string",
                        enum: ["on-grid", "off-grid", "hybride"],
                        description: "Architecture système PV"
                    },

                    // Paramètres modules
                    parametresPanneau: {
                        type: "object",
                        description: "Caractéristiques STC du module PV (IEC 61215)",
                        properties: {
                            puissanceCreteModule: {
                                type: "number",
                                minimum: 50,
                                description: "Pmax (Wp) - Puissance crête en STC"
                            },
                            tensionVoc: {
                                type: "number",
                                description: "Voc (V) - Tension circuit ouvert"
                            },
                            courantCourtCircuit: {
                                type: "number",
                                description: "Isc (A) - Courant court-circuit"
                            },
                            tensionMPP: {
                                type: "number",
                                description: "Vmpp (V) - Tension point puissance max"
                            },
                            courantMPP: {
                                type: "number",
                                description: "Impp (A) - Courant point puissance max"
                            },
                            coeffTempTension: {
                                type: "number",
                                description: "β (Voc) en /°C - Ex: -0.35%/°C → 0.0035"
                            },
                            coeffTempPuissance: {
                                type: "number",
                                description: "γ (Pmax) en /°C - Ex: -0.40%/°C → 0.0040"
                            },
                            noct: {
                                type: "number",
                                default: 45,
                                description: "NOCT (°C) - Température nominale cellule"
                            }
                        },
                        required: [
                            "puissanceCreteModule",
                            "tensionVoc",
                            "courantCourtCircuit",
                            "tensionMPP",
                            "coeffTempTension",
                            "coeffTempPuissance"
                        ]
                    },

                    // Températures
                    temperaturesAttendue: {
                        type: "object",
                        description: "Températures ambiantes extrêmes du site",
                        properties: {
                            temperatureMin: {
                                type: "number",
                                description: "°C - Température minimale (hiver, pour Voc max)"
                            },
                            temperatureMax: {
                                type: "number",
                                description: "°C - Température maximale (été, pour Vmpp min)"
                            }
                        },
                        required: ["temperatureMin", "temperatureMax"]
                    },

                    // Onduleur (optionnel pour off-grid basse tension)
                    contraintesOnduleur: {
                        type: "object",
                        description: "Caractéristiques onduleur candidat (vérification)",
                        properties: {
                            puissanceACNominale: { type: "number", description: "W" },
                            tensionDCMax: { type: "number", description: "V - Limite ABSOLUE sécurité" },
                            tensionMPPTMin: { type: "number", description: "V - Minimum MPPT" },
                            tensionMPPTMax: { type: "number", description: "V - Maximum MPPT" },
                            courantDCMax: { type: "number", description: "A - Courant entrée max" },
                            puissanceDCMax: { type: "number", description: "W - Puissance entrée max" },
                            puissanceSurcharge: { type: "number", description: "W - Pic soutenable" },
                            rendementMPPT: { type: "number", description: "Rendement MPPT (0.96-0.99)" }
                        },
                        required: ["puissanceACNominale", "tensionDCMax", "tensionMPPTMin", "tensionMPPTMax", "courantDCMax"]
                    },

                    // Stockage (requis pour off-grid/hybride)
                    autonomieBatterie: {
                        type: "number",
                        minimum: 0.5,
                        maximum: 10,
                        description: "Jours d'autonomie souhaités"
                    },
                    technologieBatterie: {
                        type: "string",
                        enum: ["Plomb-acide", "AGM/Gel", "LiFePO4", "Lithium NMC/NCA", "NiCd"],
                        default: "LiFePO4"
                    },
                    tensionSystemeBatterie: {
                        type: "number",
                        enum: [12, 24, 48],
                        description: "V - Pour systèmes off-grid basse tension"
                    },

                    // Câblage
                    cablage: {
                        type: "object",
                        properties: {
                            materiau: {
                                type: "string",
                                enum: ["cuivre", "aluminium"],
                                default: "cuivre",
                                description: "Matériau conducteur"
                            },
                            longueurString: {
                                type: "number",
                                default: 15,
                                description: "m - Câble string (champ → boîte jonction)"
                            },
                            longueurPrincipalDC: {
                                type: "number",
                                default: 10,
                                description: "m - Câble principal DC (boîte → onduleur)"
                            },
                            longueurAC: {
                                type: "number",
                                default: 20,
                                description: "m - Câble AC (onduleur → tableau)"
                            },
                            methodePoseDC: {
                                type: "string",
                                enum: ["conduit_encastre", "conduit_surface", "air_libre", "enterre", "gaine_technique"],
                                default: "conduit_surface"
                            },
                            methodePoseAC: {
                                type: "string",
                                enum: ["conduit_encastre", "conduit_surface", "air_libre", "enterre", "gaine_technique"],
                                default: "conduit_encastre"
                            },
                            conditionEnvironnement: {
                                type: "string",
                                enum: ["standard", "chaud", "tres_chaud", "extreme", "humide", "corrosif"],
                                default: "chaud",
                                description: "Conditions environnementales (impacte dé-rating)"
                            }
                        }
                    },

                    // Pompage
                    pompageSolaire: {
                        type: "boolean",
                        description: "Application pompage d'eau"
                    },
                    pompageCaracteristiques: {
                        type: "object",
                        properties: {
                            batteries: { type: "boolean" },
                            masseVolumique: { type: "number", default: 1000 },
                            accelerationPesanteur: { type: "number", default: 9.81 },
                            debit: { type: "number", description: "m³/j" },
                            hauteurMano: { type: "number", description: "m" },
                            rendementPompe: { type: "number", minimum: 0.4, maximum: 0.7 }
                        },
                        required: ["batteries", "debit", "hauteurMano", "rendementPompe"]
                    },

                    // Avancé
                    irradianceMax: {
                        type: "number",
                        default: 1000,
                        description: "W/m² - Irradiance max locale (1000-1200)"
                    }
                }
            },
            response: {
                200: {
                    description: "Dimensionnement réussi",
                    type: "object",
                    properties: {
                        resume: {
                            type: "object",
                            properties: {
                                energieJournaliere_Wh: { type: "number" },
                                puissanceCreteCharge_W: { type: "number" },
                                puissanceCretePV_Wc: { type: "number" },
                                ratioDCAC: { type: "number" },
                                surfaceEstimee_m2: { type: "number" },
                                nombreStrings: { type: "number" }
                            }
                        },
                        site: { type: "object" },
                        modulesPV: { type: "object" },
                        onduleur: { type: "object" },
                        stockage: { type: "object" },
                        cablage: { type: "object" },
                        conformite: {
                            type: "object",
                            properties: {
                                normesReference: { type: "array", items: { type: "string" } },
                                verificationVoc: { type: "boolean" },
                                verificationMPPT: { type: "boolean" },
                                verificationIsc: { type: "boolean" },
                                verificationChuteTension: { type: "boolean" },
                                avertissements: { type: "array", items: { type: "string" } },
                                erreurs: { type: "array", items: { type: "string" } }
                            }
                        },
                        meta: {
                            type: "object",
                            properties: {
                                timestamp: { type: "string", format: "date-time" },
                                versionCalculateur: { type: "string" }
                            }
                        }
                    }
                },
                400: {
                    description: "Erreur de validation ou dimensionnement impossible",
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        message: { type: "string" },
                        details: { type: "string" }
                    }
                },
                500: {
                    description: "Erreur interne serveur",
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        message: { type: "string" }
                    }
                }
            }
        },
        handler: installationPhotovoltaiqueController.dimensionnerInstallation.bind(
            installationPhotovoltaiqueController
        )
    });

    // ========== ROUTE SANTÉ ==========
    app.get("/sante", {
        schema: {
            description: "Vérification état des services de dimensionnement",
            tags: ["système"],
            response: {
                200: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string"
                        },
                        services: {
                            type: "object",
                            properties: {
                                bilanConso: { type: "string" },
                                parametresSite: { type: "string" },
                                puissancePV: { type: "string" },
                                stockage: { type: "string" },
                                cablageProtections: { type: "string" }
                            }
                        },
                        normesReference: { type: "array", items: { type: "string" } },
                        version: { type: "string" }
                    }
                }
            }
        },
        handler: installationPhotovoltaiqueController.sante.bind(
            installationPhotovoltaiqueController
        )
    });

    // ========== ROUTE DOCUMENTATION NORMES ==========
    app.get("/normes-reference", async (request, reply) => {
        return {
            normes: [
                { code: "NF C 15-100", titre: "Installations électriques BT", domaine: "Électricité générale" },
                { code: "IEC 61215", titre: "Modules PV cristallins - Qualification", domaine: "Modules" },
                { code: "IEC 62109-1/2", titre: "Sécurité onduleurs PV", domaine: "Onduleurs" },
                { code: "NF EN 50549-1/2", titre: "Producteurs BT raccordés réseau", domaine: "Grid-tied" },
                { code: "IEC 62619", titre: "Sécurité stockage Li-ion stationnaire", domaine: "Batteries" },
                { code: "IEC 61643-31", titre: "Parafoudres systèmes PV", domaine: "Protection foudre" },
                { code: "ISO 8528", titre: "Groupes électrogènes AC", domaine: "Générateurs" }
            ]
        };
    });
};