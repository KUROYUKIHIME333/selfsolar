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
