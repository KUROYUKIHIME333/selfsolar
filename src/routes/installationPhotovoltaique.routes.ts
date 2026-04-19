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
                    // LOCALISATION
                    localisation: {
                        type: "object",
                        description: "Coordonnées géographiques du site",
                        required: ["lat", "long"],
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
                        }
                    },

                    // ÉQUIPEMENTS
                    equipements: {
                        type: "array",
                        description: "Inventaire des équipements électriques",
                        items: {
                            type: "object",
                            required: ["P", "h", "ks"],
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
                            }
                        }
                    },
                    facteurFoisonnementGlobal: {
                        type: "number",
                        minimum: 0.5,
                        maximum: 1.0,
                        default: 0.8,
                        description: "Kf - Facteur de foisonnement global entre usages"
                    },

                    // TYPE INSTALLATION
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

                    // PARAMÈTRES PANNEAU
                    parametresPanneau: {
                        type: "object",
                        description: "Caractéristiques STC du module PV (IEC 61215)",
                        required: [
                            "puissanceCreteModule",
                            "tensionVoc",
                            "courantCourtCircuit",
                            "tensionMPP",
                            "coeffTempTension",
                            "coeffTempPuissance"
                        ],
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
                        }
                    },

                    // TEMPÉRATURES
                    temperaturesAttendue: {
                        type: "object",
                        description: "Températures ambiantes extrêmes du site",
                        required: ["temperatureMin", "temperatureMax"],
                        properties: {
                            temperatureMin: {
                                type: "number",
                                description: "°C - Température minimale (hiver, pour Voc max)"
                            },
                            temperatureMax: {
                                type: "number",
                                description: "°C - Température maximale (été, pour Vmpp min)"
                            }
                        }
                    },

                    // CONTRAINTES ONDULEUR
                    contraintesOnduleur: {
                        type: "object",
                        description: "Caractéristiques onduleur candidat (vérification)",
                        properties: {
                            puissanceACNominale: {
                                type: "number",
                                description: "W - Puissance sortie AC nominale"
                            },
                            tensionDCMax: {
                                type: "number",
                                description: "V - Limite ABSOLUE sécurité"
                            },
                            tensionMPPTMin: {
                                type: "number",
                                description: "V - Minimum pour fonctionnement MPPT"
                            },
                            tensionMPPTMax: {
                                type: "number",
                                description: "V - Maximum plage MPPT"
                            },
                            courantDCMax: {
                                type: "number",
                                description: "A - Courant entrée DC max"
                            },
                            puissanceDCMax: {
                                type: "number",
                                description: "W - Puissance entrée max"
                            },
                            puissanceSurcharge: {
                                type: "number",
                                description: "W - Pic soutenable (démarrage moteurs)"
                            },
                            rendementMPPT: {
                                type: "number",
                                description: "Rendement MPPT (0.96-0.99)"
                            },
                            tensionBatterieMin: {
                                type: "number",
                                description: "V - Pour hybride"
                            },
                            tensionBatterieMax: {
                                type: "number",
                                description: "V - Pour hybride"
                            },
                            puissanceChargeBatterieMax: {
                                type: "number",
                                description: "W - Pour hybride"
                            }
                        }
                    },

                    // STOCKAGE
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

                    // CÂBLAGE
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

                    // POMPAGE
                    pompageSolaire: {
                        type: "boolean",
                        description: "Application pompage d'eau"
                    },
                    pompageCaracteristiques: {
                        type: "object",
                        properties: {
                            batteries: { type: "boolean" },
                            masseVolumique: {
                                type: "number",
                                default: 1000,
                                description: "kg/m³ - Eau: 1000"
                            },
                            accelerationPesanteur: {
                                type: "number",
                                default: 9.81,
                                description: "m/s² - Standard: 9.81"
                            },
                            debit: {
                                type: "number",
                                description: "m³/j - Débit journalier requis"
                            },
                            hauteurMano: {
                                type: "number",
                                description: "m - Hauteur manométrique totale"
                            },
                            rendementPompe: {
                                type: "number",
                                minimum: 0.4,
                                maximum: 0.7,
                                description: "η pompe (0.4-0.7)"
                            }
                        },
                        required: ["batteries", "debit", "hauteurMano", "rendementPompe"]
                    },

                    // AVANCÉ
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
                        site: {
                            type: "object",
                            properties: {
                                localisation: {
                                    type: "object",
                                    properties: {
                                        lat: { type: "number" },
                                        long: { type: "number" },
                                        altitude: { type: "number" }
                                    }
                                },
                                angleOptimal: {
                                    type: "object",
                                    properties: {
                                        hemisphère: { type: "string" },
                                        orientation: { type: "string" },
                                        angle: { type: "number" }
                                    }
                                },
                                PSH_moisDefavorable: { type: "number" },
                                performanceRatio: { type: "number" },
                                pertesTotales_pourcent: { type: "number" }
                            }
                        },
                        modulesPV: {
                            type: "object",
                            properties: {
                                appareil: { type: "string" },
                                configuration: { type: "string" },
                                tensionParcPV: { type: "number" },
                                panneauxParString: { type: "number" },
                                stringsEnParallele: { type: "number" },
                                totalPanneaux: { type: "number" },
                                tensionStringSTC: { type: "number" },
                                tensionStringMin: { type: "number" },
                                tensionStringMax: { type: "number" },
                                vocStringFroid: { type: "number" },
                                puissancePVInstallee: {
                                    type: "object",
                                    properties: {
                                        min: { type: "number" },
                                        max: { type: "number" }
                                    }
                                }
                            }
                        },
                        onduleur: {
                            type: "object",
                            properties: {
                                appareil: { type: "string" },
                                typeSysteme: { type: "string" },
                                grandeursChamp: {
                                    type: "object",
                                    properties: {
                                        tCellMin: { type: "number" },
                                        tCellMax: { type: "number" },
                                        vocChampFroid: { type: "number" },
                                        vmppChampChaud: { type: "number" },
                                        vmppNominal: { type: "number" },
                                        iscChamp: { type: "number" },
                                        puissanceChampsWc: { type: "number" }
                                    }
                                },
                                dimensionnement: {
                                    type: "object",
                                    properties: {
                                        puissanceACMin: { type: "number" },
                                        puissanceACRecommandee: { type: "number" },
                                        puissanceACMax: { type: "number" },
                                        ratioDCAC: { type: "number" },
                                        evaluationRatio: { type: "string" }
                                    }
                                },
                                verification: {
                                    type: "object",
                                    properties: {
                                        compatible: { type: "boolean" },
                                        details: {
                                            type: "object",
                                            properties: {
                                                vocSousLimite: { type: "boolean" },
                                                vmppAuDessusMinimum: { type: "boolean" },
                                                vmppDansPlageMPPT: { type: "boolean" },
                                                iscSousLimite: { type: "boolean" },
                                                puissanceDCOk: { type: "boolean" },
                                                chargeACOk: { type: "boolean" },
                                                surchargeOk: { type: ["boolean", "null"] }
                                            }
                                        }
                                    }
                                },
                                avertissements: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                erreurs: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            }
                        },
                        stockage: {
                            type: ["object", "null"],
                            properties: {
                                appareil: { type: "string" },
                                typeBatterie: { type: "string" },
                                DoDMax: { type: "number" },
                                cyclesDoDMax: {
                                    type: "object",
                                    properties: {
                                        min: { type: "number" },
                                        max: { type: "number" }
                                    }
                                },
                                plageTemperatureFonctionnement: {
                                    type: "object",
                                    properties: {
                                        min: { type: "number" },
                                        max: { type: "number" }
                                    }
                                },
                                capacite: {
                                    type: "object",
                                    properties: {
                                        utile_Wh: { type: "number" },
                                        nominale_Wh: { type: "number" },
                                        nominale_Ah: { type: "number" }
                                    }
                                },
                                autonomieJours: { type: "number" },
                                temperatureDeratingApplique: { type: "boolean" }
                            }
                        },
                        cablage: {
                            type: "object",
                            properties: {
                                dc: {
                                    type: "object",
                                    properties: {
                                        cablesString: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    section: { type: "number" },
                                                    materiau: { type: "string" },
                                                    typeCable: { type: "string" },
                                                    courantAdmissible: { type: "number" },
                                                    courantDimensionnement: { type: "number" },
                                                    resistanceLineique: { type: "number" },
                                                    chuteTensionV: { type: "number" },
                                                    chuteTensionPourcent: { type: "number" },
                                                    chuteTensionMax: { type: "number" },
                                                    longueur: { type: "number" },
                                                    nombreConducteurs: { type: "number" },
                                                    temperatureAmbiante: { type: "number" },
                                                    temperatureConducteur: { type: "number" },
                                                    methodePose: { type: "string" },
                                                    facteursCorrection: {
                                                        type: "object",
                                                        properties: {
                                                            kT: { type: "number" },
                                                            kG: { type: "number" },
                                                            kP: { type: "number" },
                                                            kM: { type: "number" },
                                                            total: { type: "number" }
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        cablePrincipalDC: {
                                            type: "object",
                                            properties: {
                                                section: { type: "number" },
                                                materiau: { type: "string" },
                                                typeCable: { type: "string" },
                                                courantAdmissible: { type: "number" },
                                                courantDimensionnement: { type: "number" },
                                                resistanceLineique: { type: "number" },
                                                chuteTensionV: { type: "number" },
                                                chuteTensionPourcent: { type: "number" },
                                                chuteTensionMax: { type: "number" },
                                                longueur: { type: "number" },
                                                nombreConducteurs: { type: "number" },
                                                temperatureAmbiante: { type: "number" },
                                                temperatureConducteur: { type: "number" },
                                                methodePose: { type: "string" },
                                                facteursCorrection: {
                                                    type: "object",
                                                    properties: {
                                                        kT: { type: "number" },
                                                        kG: { type: "number" },
                                                        kP: { type: "number" },
                                                        kM: { type: "number" },
                                                        total: { type: "number" }
                                                    }
                                                }
                                            }
                                        },
                                        protectionsString: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    type: { type: "string" },
                                                    calibre: { type: "number" },
                                                    tensionAssignee: { type: "number" },
                                                    pouvoirCoupure: { type: "number" },
                                                    norme: { type: "string" },
                                                    emplacement: { type: "string" },
                                                    caracteristiques: { type: "string" }
                                                }
                                            }
                                        },
                                        protectionOnduleurDC: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    type: { type: "string" },
                                                    calibre: { type: "number" },
                                                    tensionAssignee: { type: "number" },
                                                    pouvoirCoupure: { type: "number" },
                                                    norme: { type: "string" },
                                                    emplacement: { type: "string" },
                                                    caracteristiques: { type: "string" }
                                                }
                                            }
                                        },
                                        parafoudreDC: {
                                            type: "object",
                                            properties: {
                                                type: { type: "string" },
                                                tensionAssignee: { type: "number" },
                                                norme: { type: "string" },
                                                emplacement: { type: "string" },
                                                caracteristiques: { type: "string" }
                                            }
                                        },
                                        sectionsStandardUtilisees: {
                                            type: "array",
                                            items: { type: "number" }
                                        },
                                        verificationChuteTensionGlobale: { type: "boolean" },
                                        avertissements: {
                                            type: "array",
                                            items: { type: "string" }
                                        }
                                    }
                                },
                                ac: {
                                    type: "object",
                                    properties: {
                                        section: { type: "number" },
                                        materiau: { type: "string" },
                                        courantEmploi: { type: "number" },
                                        courantAdmissible: { type: "number" },
                                        protection: { type: "number" },
                                        chuteTension: { type: "number" },
                                        chuteTensionMax: { type: "number" },
                                        ddr: {
                                            type: "object",
                                            properties: {
                                                type: { type: "string" },
                                                sensibilite: { type: "number" },
                                                norme: { type: "string" }
                                            }
                                        },
                                        methodePose: { type: "string" },
                                        facteursCorrection: {
                                            type: "object",
                                            properties: {
                                                kT: { type: "number" },
                                                kP: { type: "number" },
                                                kM: { type: "number" },
                                                total: { type: "number" }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        conformite: {
                            type: "object",
                            properties: {
                                normesReference: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                verificationVoc: { type: "boolean" },
                                verificationMPPT: { type: "boolean" },
                                verificationIsc: { type: "boolean" },
                                verificationChuteTension: { type: "boolean" },
                                avertissements: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                erreurs: {
                                    type: "array",
                                    items: { type: "string" }
                                }
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
                        status: { type: "string" },
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
                        normesReference: {
                            type: "array",
                            items: { type: "string" }
                        },
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
    app.get("/normes-reference", {
        schema: {
            description: "Liste des normes applicables au dimensionnement",
            tags: ["documentation"],
            response: {
                200: {
                    type: "object",
                    properties: {
                        normes: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    code: { type: "string" },
                                    titre: { type: "string" },
                                    domaine: { type: "string" }
                                }
                            }
                        }
                    }
                }
            }
        },
        handler: async (request, reply) => {
            return {
                normes: [
                    { code: "NF C 15-100", titre: "Installations électriques BT - Règle générale", domaine: "Électricité générale" },
                    { code: "IEC 61215", titre: "Modules PV cristallins - Qualification", domaine: "Modules" },
                    { code: "IEC 62109-1/2", titre: "Sécurité des onduleurs pour systèmes PV", domaine: "Onduleurs" },
                    { code: "NF EN 50549-1/2", titre: "Prescriptions connexion producteurs au réseau", domaine: "Grid-tied" },
                    { code: "IEC 62116", titre: "Test d'anti-îlotage des onduleurs PV", domaine: "Grid-tied" },
                    { code: "IEC 62619", titre: "Sécurité des systèmes de stockage Li-ion stationnaires", domaine: "Batteries" },
                    { code: "IEC 60896", titre: "Batteries plomb-acide stationnaires", domaine: "Batteries" },
                    { code: "ISO 8528", titre: "Groupes électrogènes AC - Spécifications", domaine: "Générateurs" },
                    { code: "IEC 61643-31", titre: "Parafoudres pour systèmes photovoltaïques", domaine: "Protection foudre" },
                    { code: "NF EN 62305", titre: "Protection contre la foudre", domaine: "Foudre" },
                    { code: "IEC 62955", titre: "Détection courant de fuite continu (RCDC)", domaine: "Protection différentielle" },
                    { code: "NF EN IEC 61851-1", titre: "Systèmes de recharge véhicules électriques", domaine: "IRVE" }
                ]
            };
        }
    });

    // ========== ROUTE LISTE DES PANNEAUX & BATTERIES ==========
    app.get("/listes", {
        handler: installationPhotovoltaiqueController.listes.bind(
            installationPhotovoltaiqueController
        )
    })

    // ========== ROUTE LISTE DES PANNEAUX ==========
    app.get("/liste/panneaux", {
        handler: installationPhotovoltaiqueController.listePanneaux.bind(
            installationPhotovoltaiqueController
        )
    })

    // ========== ROUTE LISTE DES PANNEAUX ==========
    app.get("/liste/batteries", {
        handler: installationPhotovoltaiqueController.listeBatteries.bind(
            installationPhotovoltaiqueController
        )
    })
};