import { FastifyInstance } from "fastify";
import { installationPhotovoltaiqueController } from "../controllers/installationPhotovoltaique.controllers.js";

// Routes API pour le dimensionnement photovoltaïque
// Base: /api/v1/pv/*
export const installationPhotovoltaiqueRoutes = async (
  app: FastifyInstance
) => {
  // ROUTE CONSOMMATION ENERGETIQUE
  app.post("/consommation-energetique", {
    schema: {
      description: "Consommation énergétique et puissance consommée",
      tags: [
        "énergie crète",
        "puissance",
        "énergie journalière",
        "puissance appelée",
        "puissance installée",
        "puissance pic",
        "pic",
      ],
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
      tags: ["PVGIS", "PSH", "irradiance", "G", "climat", "temperatures"],
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
    },
    handler: installationPhotovoltaiqueController.analyserGeographie.bind(
      installationPhotovoltaiqueController
    ),
  });

  // ROUTE DIMMENSIONNEMENT BATTERIES
  app.post("/stockage-batteries", {
    schema: {
      description: "Caractéristiques du système de stockage par batteries",
      tags: ["batteries", "stockage", "Lithium", "acide", "AGM/GEL"],
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
                type: "boolean",
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
