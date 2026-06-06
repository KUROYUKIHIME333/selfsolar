import { FastifyInstance } from "fastify";
import { installationPhotovoltaiqueController } from "../controllers/installationPhotovoltaique.controllers.js";

/**
 * WARNING:
 * Toutes les routes suivante ont comme prefixe:
 * /api/v1/pv/
 *
 * Par exemple:  /api/v1/pv/donnees-meteo ou /api/v1/pv/onduleur
 */

export const installationPhotovoltaiqueRoutes = async (
  app: FastifyInstance
) => {
  // ROUTE CONSOMMATION ENERGETIQUE
  app.post("/consommation-energetique", {
    schema: {
      description: "Consommation énergétique et puissance AC installée",
      tags: ["énergie installée & puissance AC"],
      body: {
        type: "object",
        required: ["equipements"],
        properties: {
          equipements: {
            type: "array",
            description: "Inventaire des équipements électriques",
            items: {
              type: "object",
              required: ["P", "h"],
              properties: {
                nom: {
                  type: "string",
                  description: "Nom de l'équipement",
                },
                P: {
                  type: "number",
                  minimum: 0,
                  description: "Puissance nominale (W)",
                },
                h: {
                  type: "number",
                  minimum: 0,
                  maximum: 24,
                  description: "Durée d'utilisation journalière (h/j)",
                },
                k: {
                  type: "number",
                  minimum: 1,
                  description: "Facteur de pic (au démarrage surtout)",
                },
              },
            },
          },
          facteurFoisonnementGlobal: {
            type: "number",
            minimum: 0.5,
            maximum: 1.0,
            default: 1.0,
            description: "Kf - Facteur de foisonnement global",
          },
        },
      },
      response: {
        200: {
          description:
            "Consommation énergétique et puissance AC installée trouvée",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: true,
            },
            error: { type: "null" },
            data: {
              type: "object",
              properties: {
                energieJournaliereWh: { type: "number", minimum: 0 },
                puissanceAppeleeW: { type: "number", minimum: 0 },
                puissanceInstalleeW: { type: "number", minimum: 0 },
                puissancePicW: { type: "number", minimum: 0 },
              },
            },
          },
        },
        400: {
          description: "Erreur de validation ou Calcul impossible",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: false,
            },
            error: { type: "string" },
            data: { type: "null" },
          },
        },
        500: {
          description: "Erreur interne au serveur",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: false,
            },
            error: { type: "string" },
            data: { type: "null" },
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.analyserConsommation.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE DONNEES PVGIS ET METEO
  app.post("/donnees-meteo", {
    schema: {
      description:
        "Données météo solaire et climatique du site de l'installation",
      tags: ["PDonnées météo solaire & températures"],
      body: {
        type: "object",
        required: ["localisation"],
        properties: {
          localisation: {
            type: "object",
            description: "Coordonnées géographiques du site",
            required: ["lat", "long"],
            properties: {
              lat: {
                type: "number",
                minimum: -90,
                maximum: 90,
                description: "Latitude en degrés décimaux",
              },
              long: {
                type: "number",
                minimum: -180,
                maximum: 180,
                description: "Longitude en degrés décimaux",
              },
              altitude: {
                type: "number",
                description: "Altitude en mètres (pour déclassement)",
              },
            },
          },
        },
      },
      response: {
        200: {
          description: "Données météo trouvées",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: true,
            },
            error: { type: "null" },
            data: {
              type: "object",
              properties: {
                localisation: {
                  type: "object",
                  properties: {
                    lat: {
                      type: "number",
                      minimum: -90,
                      maximum: 90,
                      description: "Latitude en degrés décimaux",
                    },
                    long: {
                      type: "number",
                      minimum: -180,
                      maximum: 180,
                      description: "Longitude en degrés décimaux",
                    },
                    altitude: {
                      type: "number",
                      description: "Altitude en mètres (pour déclassement)",
                    },
                  },
                },
                orientation: {
                  type: "string",
                },
                angle: {
                  type: "number",
                },
                angleOptimal: { type: "number" },
                PSH: { type: "number" },
                PSH_max: { type: "number" },
                G_moy: { type: "number" },
                G_max: { type: "number" },
                T_min: { type: "number" },
                T_max: { type: "number" },
                windSpeed_mean: { type: "number" },
                windSpeed_max: { type: "number" },
                moisDefavorable: { type: "string" },
                moisSurfavorable: { type: "string" },
                isFallback: { type: "boolean" },
                climateCorrection: {
                  type: "object",
                  properties: {
                    dT: { type: "number" },
                    dGPercent: { type: "number" },
                    targetYear: { type: "number" },
                    fraction: { type: "number" },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Erreur de validation ou Données introuvables",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: false,
            },
            error: { type: "string" },
            data: { type: "null" },
          },
        },
        500: {
          description: "Erreur interne au serveur",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: false,
            },
            error: { type: "string" },
            data: { type: "null" },
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.analyserGeographie.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE DIMMENSIONNEMENT BATTERIES
  app.post("/stockage-batteries", {
    schema: {
      description: "Caractéristiques du système de stockage par batteries",
      tags: ["Stockage par batteries"],
      body: {
        type: "object",
        required: [
          "technologieBattery",
          "energieJournaliere_Wh",
          "autonomieBatterie_jours",
          "tensionSystemeBatterie_V",
          "temperatureAmbiante_C",
        ],
        properties: {
          technologieBattery: {
            type: "string",
            description:
              "Technologie de batteries utilisées: Plomb-acide , AGM/Gel , LiFePO4 , Lithium NMC/NCA ou NiCd",
          },
          energieJournaliere_Wh: {
            type: "number",
            description: "Consommation d'énergie journalière",
          },
          autonomieBatterie_jours: {
            type: "number",
            description: "Nombre de jours d'autonomie",
          },
          tensionSystemeBatterie_V: {
            type: "number",
            description: "Tension des batteries en V",
          },
          temperatureAmbiante_C: {
            type: "number",
            description:
              "Temperature ambiante pour prendre en compte le dérating des batteries",
          },
        },
      },
      response: {
        200: {
          description: "Capacité du système de stockage par batteries",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: true,
            },
            error: { type: "null" },
            data: {
              type: "object",
              properties: {
                appareil: { type: "string" },
                typeBatterie: { type: "string" },
                DoDMax: { type: "number" }, // Profondeur décharge max (0.5-0.9)
                cyclesDoDMax: {
                  type: "object",
                  properties: {
                    min: { type: "number" },
                    max: { type: "number" },
                  },
                },
                plageTemperatureFonctionnement: {
                  type: "object",
                  properties: {
                    min: { type: "number" },
                    max: { type: "number" },
                  },
                },
                capacite: {
                  type: "object",
                  properties: {
                    utile_Wh: { type: "number" },
                    nominale_Wh: { type: "number" },
                    nominale_Ah: { type: "number" },
                  },
                },

                autonomieJours: { type: "number" },
                temperatureDeratingApplique: { type: "boolean" },
              },
            },
          },
        },
        400: {
          description: "Erreur de validation ou Probleme de calcul/logique",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: false,
            },
            error: { type: "string" },
            data: { type: "null" },
          },
        },
        500: {
          description: "Erreur interne au serveur",
          type: "object",
          properties: {
            success: {
              type: "boolean",
              default: false,
            },
            error: { type: "string" },
            data: { type: "null" },
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.etablirStockage.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE PUISSANCE CRETE
  app.post("/puissance-crete", {
    schema: {
      description: "Déterminer la puissance crète du système pv",
      tags: ["puissance crète", "Pc"],
      body: {
        type: "object",
        required: [
          "typeInstallation",
          "pompageSolaire",
          "PSH_heuresParJour",
          "avecStockage",
        ],
        properties: {
          typeInstallation: {
            type: "string",
            default: "STANDARD",
            description:
              "Type d'installation: HAUTE_QUALITE , STANDARD , POUSSIEREUX , FAIBLE_MAINTENANCE , ANCIEN ou CABLE_LONG",
          },
          pompageSolaire: {
            type: "boolean",
            description: "Est ce une installation de pompage solaire ou pas",
          },
          energieCrete_Wh: {
            type: "number",
            minimum: 0,
            description: "Consommation énergétique journaliere ne Wh/j",
          },
          PSH_heuresParJour: {
            type: "number",
            minimum: 0,
            description: "Heure d'irradiance max par jour",
          },
          avecStockage: {
            type: "boolean",
            description:
              "Est ce une installation ayant un stockage d'énergie par batteries ou pas",
          },
          pompageCaracteristiques: {
            type: "object",
            description: "",
            required: [
              "batteries",
              "masseVolumique",
              "accelerationPesanteur",
              "debit",
              "hauteurMano",
              "rendementPompe",
            ],
            properties: {
              batteries: {
                type: "boolean",
                default: false,
                description:
                  "Est ce une installation ayant un stockage d'énergie par batteries ou pas",
              },
              masseVolumique: {
                type: "number",
                minimum: 0,
                description:
                  "Masse volumique du fluide pompé, en kg/mètre cube",
              },
              accelerationPesanteur: {
                type: "number",
                minimum: 0,
                description: "g (comme g=9.81m/s²) en m/s²",
              },
              debit: {
                type: "number",
                minimum: 0,
                description: "Débit de la pompe en metre cube / s",
              },
              hauteurMano: {
                type: "number",
                minimum: 0,
                description: "Hauteur manométrique en m",
              },
              rendementPompe: {
                type: "number",
                minimum: 0,
                maximum: 1,
                description: "rendement de la pompe",
              },
            },
          },
          rendementOnduleurMPPT: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "rendement de l'onduleur'",
          },
          technologieBatteries: {
            type: "string",
            description:
              "Technologie de batteries utilisées: Plomb-acide , AGM/Gel , LiFePO4 , Lithium NMC/NCA ou NiCd",
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.etablirPuissanceCrete.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE MODULES PV
  app.post("/panneaux-pv", {
    schema: {
      description: "Caractéristiques des panneaux photovoltaiques",
      tags: ["panneaux photovoltaiques", "modules pv", "panneaux", "pv"],
      body: {
        type: "object",
        required: [
          "parametresPanneau",
          "puissanceCretePV_Wc",
          "temperaturesAttendue",
          "irradianceMax_W_m2",
          "tensionSysteme_V",
          "configurationTensionSysteme",
        ],
        properties: {
          parametresPanneau: {
            type: "object",
            required: [
              "puissanceCreteModule",
              "tensionMPP",
              "tensionVoc",
              "courantMPP",
              "courantCourtCircuit",
              "coeffTempTension",
              "coeffTempPuissance",
              "noct",
            ],
            properties: {
              puissanceCreteModule: {
                type: "number",
                minimum: 0,
              },
              tensionMPP: {
                type: "number",
                minimum: 0,
              },
              tensionVoc: {
                type: "number",
                minimum: 0,
              },
              courantMPP: {
                type: "number",
                minimum: 0,
              },
              courantCourtCircuit: {
                type: "number",
                minimum: 0,
              },
              coeffTempTension: {
                type: "number",
              },
              coeffTempPuissance: {
                type: "number",
              },
              coeffTempCourant: {
                type: "number",
              },
              noct: {
                type: "number",
                minimum: 0,
              },
            },
          },
          puissanceCretePV_Wc: {
            type: "number",
            minimum: 0,
          },
          temperaturesAttendue: {
            type: "object",
            required: ["temperatureMin", "temperatureMax"],
            properties: {
              temperatureMin: {
                type: "number",
                minimum: -100,
                maximum: 100,
              },
              temperatureMax: {
                type: "number",
                minimum: -100,
                maximum: 100,
              },
            },
          },
          irradianceMax_W_m2: {
            type: "number",
            minimum: 0,
          },
          tensionSysteme_V: {
            type: "number",
            minimum: 0,
          },
          configurationTensionSysteme: {
            type: "string",
            description:
              "Configuration de la tension du système : haute_tension , basse_tension ou indefini",
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.dimensionnerModulesPV.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE MODULES BATTERIES
  app.post("/batteries-nombres-et-config", {
    schema: {
      description: "Nombres de batteries en serie et parallele",
      tags: ["Ns", "Np", "N", "nombre de batteries"],
      body: {
        type: "object",
        required: [
          "tensionSysteme_V",
          "tensionUnitaireBatterie_V",
          "capaciteUnitaireBatterie_Ah",
          "capaciteTotaleRequise_Ah",
        ],
        properties: {
          tensionSysteme_V: {
            type: "number",
            minimum: 0,
          },
          tensionUnitaireBatterie_V: {
            type: "number",
            minimum: 0,
          },
          capaciteUnitaireBatterie_Ah: {
            type: "number",
            minimum: 0,
          },
          capaciteTotaleRequise_Ah: {
            type: "number",
            minimum: 0,
          },
        },
      },
    },
    handler:
      installationPhotovoltaiqueController.dimensionnerModulesBatteries.bind(
        installationPhotovoltaiqueController
      ),
  });

  // ROUTE ONDULEUR
  app.post("/onduleur", {
    schema: {
      description:
        "Vérification de l'onduleur proposé ou bien choix d'un onduleur adapté",
      tags: ["onduleur", "MPPT", "PWM"],
      body: {
        type: "object",
        required: [
          "resultats_modules",
          "parametres_panneaux",
          "irradiance_max",
          "typeSysteme",
          "puissance_chargeContinue",
        ],
        properties: {
          resultats_modules: {
            type: "object",
            required: [
              "appareil",
              "panneauxParString",
              "stringsEnParallele",
              "totalPanneaux",
              "tensionStringSTC",
              "tensionStringMin",
              "tensionStringMax",
              "vocStringFroid",
              "courantPVMin",
              "courantPVMax",
              "courantCourtCircuitPV",
              "puissancePVInstallee",
              "_temperaturesCellule",
              "_modules",
            ],
            properties: {
              appareil: {
                type: "string",
              },
              configuration: {
                type: "string",
              },
              // Disposition
              panneauxParString: {
                type: "number",
                minimum: 0,
              }, // Ns
              stringsEnParallele: {
                type: "number",
                minimum: 0,
              }, // Np
              totalPanneaux: {
                type: "number",
                minimum: 0,
              },
              // Tensions (important pour vérifications)
              tensionStringSTC: {
                type: "number",
                minimum: 0,
              }, // Vmpp à 25°C
              tensionStringMin: {
                type: "number",
                minimum: 0,
              }, // Vmpp à Tmax (condition chaude)
              tensionStringMax: {
                type: "number",
                minimum: 0,
              }, // Vmpp à Tmin (condition froide)
              vocStringFroid: {
                type: "number",
                minimum: 0,
              }, // Voc à Tmin (CRITIQUE sécurité)
              //Courants champ
              courantPVMin: {
                type: "number",
                minimum: 0,
              },
              courantPVMax: {
                type: "number",
                minimum: 0,
              },
              courantCourtCircuitPV: {
                type: "number",
                minimum: 0,
              },
              // Puissances
              puissancePVInstallee: {
                type: "object",
                required: ["min", "max", "stc"],
                properties: {
                  min: {
                    type: "number",
                    minimum: 0,
                  }, // Condition chaude (déclassée)
                  max: {
                    type: "number",
                    minimum: 0,
                  }, // Condition froide
                  stc: {
                    type: "number",
                    minimum: 0,
                  }, // Puissance nominale à STC (pour ratio DC/AC)
                },
              },
              // Métadonnées internes
              _temperaturesCellule: {
                type: "object",
                required: ["tCellMin", "tCellMax"],
                properties: {
                  tCellMin: {
                    type: "number",
                    minimum: 0,
                  },
                  tCellMax: {
                    type: "number",
                    minimum: 0,
                  },
                },
              },

              _modules: {
                type: "object",
                required: [
                  "vmppModuleChaud",
                  "vmppModuleFroid",
                  "vocModuleFroid",
                ],
                properties: {
                  vmppModuleChaud: {
                    type: "number",
                    minimum: 0,
                  },
                  vmppModuleFroid: {
                    type: "number",
                    minimum: 0,
                  },
                  vocModuleFroid: {
                    type: "number",
                    minimum: 0,
                  },
                },
              },
            },
          },
          parametres_panneaux: {
            type: "object",
            required: [
              "puissanceCreteModule",
              "tensionMPP",
              "tensionVoc",
              "courantMPP",
              "courantCourtCircuit",
              "coeffTempTension",
              "coeffTempPuissance",
              "noct",
            ],
            properties: {
              puissanceCreteModule: {
                type: "number",
                minimum: 0,
              },
              tensionMPP: {
                type: "number",
                minimum: 0,
              },
              tensionVoc: {
                type: "number",
                minimum: 0,
              },
              courantMPP: {
                type: "number",
                minimum: 0,
              },
              courantCourtCircuit: {
                type: "number",
                minimum: 0,
              },
              coeffTempTension: {
                type: "number",
              },
              coeffTempPuissance: {
                type: "number",
              },
              coeffTempCourant: {
                type: "number",
              },
              noct: {
                type: "number",
                minimum: 0,
              },
            },
          },
          irradiance_max: {
            type: "number",
            minimum: 0,
          },
          typeSysteme: {
            type: "string",
            description: "Le type de système: on-grid , off-grid ou hybride",
          },
          puissance_chargeContinue: {
            type: "number",
            minimum: 0,
          },
          onduleur_propose: {
            type: "object",
            required: [
              // Puissances
              "puissanceACNominale",
              "tensionDCMax",
              "tensionMPPTMin",
              "tensionMPPTMax",
              "courantDCMax",
            ],
            properties: {
              // Puissances
              puissanceACNominale: {
                type: "number",
                minimum: 0,
              }, // W - Puissance sortie AC nominale
              puissanceDCMax: {
                type: "number",
                minimum: 0,
              }, // W - Puissance entrée DC max
              puissanceSurcharge: {
                type: "number",
                minimum: 0,
              }, // W - Pic soutenable (démarrage moteurs)
              rendementMPPT: {
                type: "number",
                minimum: 0,
              }, // %/100 - Rendement MPPT (0.96-0.99)

              // Tensions DC (critiques pour sécurité)
              tensionDCMax: {
                type: "number",
                minimum: 0,
              }, // V - Limite ABSOLUE (sécurité)
              tensionMPPTMin: {
                type: "number",
                minimum: 0,
              }, // V - Minimum pour fonctionnement MPPT
              tensionMPPTMax: {
                type: "number",
                minimum: 0,
              }, // V - Maximum plage MPPT

              // Courants
              courantDCMax: {
                type: "number",
                minimum: 0,
              }, // A - Courant entrée DC max par MPPT

              // Off-grid/hybride uniquement
              tensionBatterieMin: {
                type: "number",
                minimum: 0,
              }, // V
              tensionBatterieMax: {
                type: "number",
                minimum: 0,
              }, // V
              puissanceChargeBatterieMax: {
                type: "number",
                minimum: 0,
              }, // W
            },
          },
          puissance_demarrage: {
            type: "number",
            minimum: 0,
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.dimensionnerOnduleur.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE CABLES & PROTECTIONS
  app.post("/cables-et-protections", {
    schema: {
      description: "Dimensionner les cables et choisir les protections",
      tags: ["câbles", "protections", "fusibles", "disjoncters", "calibre"],
      body: {
        type: "object",
        required: [
          "resultatModules",
          "Parametres_panneau",
          "longueur_cable_String_m",
          "longueur_cable_principal_m",
          "temperatureAmbiante",
          "materiau_conducteur_AC",
          "materiau_conducteur_DC",
          "puissance_nominale_onduleur_Wh",
          "tension_Reseau_V",
          "is_Triphase",
          "longueur_Meters",
          "cosPhi",
          "methodePose",
        ],
        properties: {
          resultatModules: {
            type: "object",
            required: [
              "appareil",
              "panneauxParString",
              "stringsEnParallele",
              "totalPanneaux",
              "tensionStringSTC",
              "tensionStringMin",
              "tensionStringMax",
              "vocStringFroid",
              "courantPVMin",
              "courantPVMax",
              "courantCourtCircuitPV",
              "puissancePVInstallee",
              "_temperaturesCellule",
              "_modules",
            ],
            properties: {
              appareil: {
                type: "string",
              },
              configuration: {
                type: "string",
              },
              // Disposition
              panneauxParString: {
                type: "number",
                minimum: 0,
              }, // Ns
              stringsEnParallele: {
                type: "number",
                minimum: 0,
              }, // Np
              totalPanneaux: {
                type: "number",
                minimum: 0,
              },
              // Tensions (important pour vérifications)
              tensionStringSTC: {
                type: "number",
                minimum: 0,
              }, // Vmpp à 25°C
              tensionStringMin: {
                type: "number",
                minimum: 0,
              }, // Vmpp à Tmax (condition chaude)
              tensionStringMax: {
                type: "number",
                minimum: 0,
              }, // Vmpp à Tmin (condition froide)
              vocStringFroid: {
                type: "number",
                minimum: 0,
              }, // Voc à Tmin (CRITIQUE sécurité)
              //Courants champ
              courantPVMin: {
                type: "number",
                minimum: 0,
              },
              courantPVMax: {
                type: "number",
                minimum: 0,
              },
              courantCourtCircuitPV: {
                type: "number",
                minimum: 0,
              },
              // Puissances
              puissancePVInstallee: {
                type: "object",
                required: ["min", "max", "stc"],
                properties: {
                  min: {
                    type: "number",
                    minimum: 0,
                  }, // Condition chaude (déclassée)
                  max: {
                    type: "number",
                    minimum: 0,
                  }, // Condition froide
                  stc: {
                    type: "number",
                    minimum: 0,
                  }, // Puissance nominale à STC (pour ratio DC/AC)
                },
              },
              // Métadonnées internes
              _temperaturesCellule: {
                type: "object",
                required: ["tCellMin", "tCellMax"],
                properties: {
                  tCellMin: {
                    type: "number",
                    minimum: 0,
                  },
                  tCellMax: {
                    type: "number",
                    minimum: 0,
                  },
                },
              },
              _modules: {
                type: "object",
                required: [
                  "vmppModuleChaud",
                  "vmppModuleFroid",
                  "vocModuleFroid",
                ],
                properties: {
                  vmppModuleChaud: {
                    type: "number",
                    minimum: 0,
                  },
                  vmppModuleFroid: {
                    type: "number",
                    minimum: 0,
                  },
                  vocModuleFroid: {
                    type: "number",
                    minimum: 0,
                  },
                },
              },
            },
          },
          Parametres_panneau: {
            type: "object",
            required: [
              "puissanceCreteModule",
              "tensionMPP",
              "tensionVoc",
              "courantMPP",
              "courantCourtCircuit",
              "coeffTempTension",
              "coeffTempPuissance",
              "noct",
            ],
            properties: {
              puissanceCreteModule: {
                type: "number",
                minimum: 0,
              },
              tensionMPP: {
                type: "number",
                minimum: 0,
              },
              tensionVoc: {
                type: "number",
                minimum: 0,
              },
              courantMPP: {
                type: "number",
                minimum: 0,
              },
              courantCourtCircuit: {
                type: "number",
                minimum: 0,
              },
              coeffTempTension: {
                type: "number",
              },
              coeffTempPuissance: {
                type: "number",
              },
              coeffTempCourant: {
                type: "number",
              },
              noct: {
                type: "number",
                minimum: 0,
              },
            },
          },
          longueur_cable_String_m: {
            type: "number",
            minimum: 0,
          },
          longueur_cable_principal_m: {
            type: "number",
            minimum: 0,
          },
          temperatureAmbiante: {
            type: "number",
            minimum: -100,
            maximum: 100,
          },
          materiau_conducteur_AC: {
            type: "string",
            description: "Matériaux conducteurs: cuivre ou aluminium",
          },
          materiau_conducteur_DC: {
            type: "string",
            description: "Matériaux conducteurs: cuivre ou aluminium",
          },
          puissance_nominale_onduleur_Wh: {
            type: "number",
            minimum: 0,
          },
          tension_Reseau_V: {
            type: "number",
            minimum: 0,
          },
          is_Triphase: {
            type: "boolean",
            description: "Le système est il triphasé ou non",
          },
          longueur_Meters: {
            type: "number",
            minimum: 0,
          },
          cosPhi: {
            type: "number",
            minimum: -1,
            maximum: 1,
          },
          methodePose: {
            type: "string",
            description:
              "Mode de pose selon NF C 15 100 : conduit_encastre , conduit_surface , air_libre , enterre ou gaine_technique",
          },
        },
      },
    },
    handler:
      installationPhotovoltaiqueController.dimensionnerCablesEtProtections.bind(
        installationPhotovoltaiqueController
      ),
  });

  // ROUTE SANTÉ
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
                cablageProtections: { type: "string" },
              },
            },
            normesReference: {
              type: "array",
              items: { type: "string" },
            },
            version: { type: "string" },
          },
        },
      },
    },
    handler: installationPhotovoltaiqueController.sante.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE DOCUMENTATION NORMES
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
                  domaine: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    handler: async () => {
      return {
        normes: [
          {
            code: "NF C 15-100",
            titre: "Installations électriques BT - Règle générale",
            domaine: "Électricité générale",
          },
          {
            code: "IEC 61215",
            titre: "Modules PV cristallins - Qualification",
            domaine: "Modules",
          },
          {
            code: "IEC 62109-1/2",
            titre: "Sécurité des onduleurs pour systèmes PV",
            domaine: "Onduleurs",
          },
          {
            code: "NF EN 50549-1/2",
            titre: "Prescriptions connexion producteurs au réseau",
            domaine: "Grid-tied",
          },
          {
            code: "IEC 62116",
            titre: "Test d'anti-îlotage des onduleurs PV",
            domaine: "Grid-tied",
          },
          {
            code: "IEC 62619",
            titre: "Sécurité des systèmes de stockage Li-ion stationnaires",
            domaine: "Batteries",
          },
          {
            code: "IEC 60896",
            titre: "Batteries plomb-acide stationnaires",
            domaine: "Batteries",
          },
          {
            code: "ISO 8528",
            titre: "Groupes électrogènes AC - Spécifications",
            domaine: "Générateurs",
          },
          {
            code: "IEC 61643-31",
            titre: "Parafoudres pour systèmes photovoltaïques",
            domaine: "Protection foudre",
          },
          {
            code: "NF EN 62305",
            titre: "Protection contre la foudre",
            domaine: "Foudre",
          },
          {
            code: "IEC 62955",
            titre: "Détection courant de fuite continu (RCDC)",
            domaine: "Protection différentielle",
          },
          {
            code: "NF EN IEC 61851-1",
            titre: "Systèmes de recharge véhicules électriques",
            domaine: "IRVE",
          },
        ],
      };
    },
  });

  // ROUTE LISTE DES PANNEAUX & BATTERIES
  app.get("/listes", {
    handler: installationPhotovoltaiqueController.listes.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE LISTE DES PANNEAUX
  app.get("/listes/panneaux", {
    handler: installationPhotovoltaiqueController.listePanneaux.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE LISTE DES PANNEAUX
  app.get("/listes/batteries", {
    handler: installationPhotovoltaiqueController.listeBatteries.bind(
      installationPhotovoltaiqueController
    ),
  });
};
