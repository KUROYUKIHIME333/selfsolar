export const LISTE_BATTERIES = {
    "plomb_acide_flooded": {
        "label": "Plomb-acide (Ouverte/Flooded)",
        "options": [
            { "v": 6, "ah": 180, "desc": "Traction légère / Voiturette" },
            { "v": 6, "ah": 225, "desc": "Solaire cycle profond (T-105 style)" },
            { "v": 12, "ah": 35, "desc": "Petite cylindrée / Groupe secours" },
            { "v": 12, "ah": 45, "desc": "Citadine standard" },
            { "v": 12, "ah": 60, "desc": "Berline / Usage domestique léger" },
            { "v": 12, "ah": 75, "desc": "Utilitaire / Installation 12V" },
            { "v": 12, "ah": 90, "desc": "Camionnette / Backup" },
            { "v": 12, "ah": 100, "desc": "Solaire classique" },
            { "v": 12, "ah": 110, "desc": "Loisirs / Marine" },
            { "v": 12, "ah": 125, "desc": "Stockage moyen" },
            { "v": 12, "ah": 150, "desc": "Standard Solaire RDC (Grand public)" },
            { "v": 12, "ah": 180, "desc": "Gros utilitaire / Stationnaire" },
            { "v": 12, "ah": 200, "desc": "Standard Solaire RDC (Premium)" },
            { "v": 12, "ah": 220, "desc": "Gros onduleur" },
            { "v": 12, "ah": 250, "desc": "Capacité maximale monobloc 12V" },
            { "v": 2, "ah": 200, "desc": "Cellule OPzS (Unité)" },
            { "v": 2, "ah": 600, "desc": "Cellule OPzS industrielle" },
            { "v": 2, "ah": 1500, "desc": "Stationnaire Très Haute Capacité" }
        ]
    },
    
    "agm_gel": {
        "label": "AGM / Gel (VRLA)",
        "options": [
            { "v": 12, "ah": 1.2, "desc": "Alarme incendie / Secours" },
            { "v": 12, "ah": 4.5, "desc": "Jouets / Équipement médical" },
            { "v": 12, "ah": 7.2, "desc": "Standard UPS (Onduleur bureau)" },
            { "v": 12, "ah": 9, "desc": "UPS Haute performance" },
            { "v": 12, "ah": 12, "desc": "Petit scooter / Alarme" },
            { "v": 12, "ah": 18, "desc": "Onduleur serveur léger" },
            { "v": 12, "ah": 26, "desc": "Télécom / Backup local" },
            { "v": 12, "ah": 33, "desc": "Fauteuil roulant électrique" },
            { "v": 12, "ah": 40, "desc": "AGM démarrage Stop&Start" },
            { "v": 12, "ah": 55, "desc": "Mobilité / Énergie" },
            { "v": 12, "ah": 65, "desc": "Solaire Deep Cycle" },
            { "v": 12, "ah": 80, "desc": "Gel Marine / Camping-car" },
            { "v": 12, "ah": 100, "desc": "Solaire Premium (DOD 50%)" },
            { "v": 12, "ah": 120, "desc": "Onduleur hybride" },
            { "v": 12, "ah": 150, "desc": "Stockage Gel haute capacité" },
            { "v": 12, "ah": 200, "desc": "Standard Gel (Solaire/Backup)" },
            { "v": 12, "ah": 230, "desc": "Gros stockage étanche" },
            { "v": 2, "ah": 1000, "desc": "Cellule OPzV industrielle" },
            { "v": 2, "ah": 2000, "desc": "Stationnaire Télécom / Réseau" }
        ]
    },

    "lifepo4": {
        "label": "Lithium Fer Phosphate (LFP)",
        "options": [
            { "v": 3.2, "ah": 100, "desc": "Cellule prismatique DIY" },
            { "v": 3.2, "ah": 280, "desc": "Cellule DIY Standard (EVE/CATL)" },
            { "v": 12.8, "ah": 12, "desc": "Remplace Plomb 12Ah" },
            { "v": 12.8, "ah": 50, "desc": "Camping / Portable" },
            { "v": 12.8, "ah": 100, "desc": "Remplace Plomb 100Ah (Drop-in)" },
            { "v": 12.8, "ah": 200, "desc": "Unité 12V 2.5kWh" },
            { "v": 12.8, "ah": 300, "desc": "Forte autonomie 12V" },
            { "v": 25.6, "ah": 50, "desc": "Solaire 24V compact" },
            { "v": 25.6, "ah": 100, "desc": "Solaire 24V standard (2.5kWh)" },
            { "v": 25.6, "ah": 200, "desc": "Solaire 24V haute capacité (5kWh)" },
            { "v": 51.2, "ah": 50, "desc": "Rack Télécom 48V léger" },
            { "v": 51.2, "ah": 100, "desc": "Standard Rack 48V (5.12kWh)" },
            { "v": 51.2, "ah": 105, "desc": "Modèle vertical (Powerwall style)" },
            { "v": 51.2, "ah": 150, "desc": "Stockage intermédiaire" },
            { "v": 51.2, "ah": 200, "desc": "Rack Haute Capacité (10kWh)" },
            { "v": 51.2, "ah": 280, "desc": "Pack Haute densité (14kWh)" },
            { "v": 96, "ah": 100, "desc": "Haute Tension (HV) résidentielle" },
            { "v": 192, "ah": 50, "desc": "Système HV Industriel" },
            { "v": 384, "ah": 100, "desc": "Stockage Tertiaire / Micro-grid" }
        ]
    },

    "lithium_nmc_nca": {
        "label": "Lithium NMC / NCA",
        "options": [
            { "v": 3.7, "ah": 2.6, "desc": "Cellule 18650 standard" },
            { "v": 3.7, "ah": 3.5, "desc": "Cellule 18650 haute capacité" },
            { "v": 3.7, "ah": 5.0, "desc": "Cellule 21700 (Tesla/Panasonic)" },
            { "v": 7.4, "ah": 2.2, "desc": "Appareils photo / Électronique" },
            { "v": 11.1, "ah": 5.0, "desc": "Lipo Drone / Modélisme" },
            { "v": 14.8, "ah": 10, "desc": "Équipement médical / Vidéo" },
            { "v": 24, "ah": 20, "desc": "Robotique / Outillage" },
            { "v": 36, "ah": 10, "desc": "Vélos électriques (E-bike)" },
            { "v": 36, "ah": 17.5, "desc": "E-bike longue distance" },
            { "v": 48, "ah": 13, "desc": "Trottinette électrique" },
            { "v": 48, "ah": 20, "desc": "Trottinette haute performance" },
            { "v": 48, "ah": 100, "desc": "Backup haute densité compact" },
            { "v": 60, "ah": 30, "desc": "Scooter électrique" },
            { "v": 72, "ah": 45, "desc": "Moto électrique" },
            { "v": 72, "ah": 60, "desc": "Moto électrique (Long Range)" },
            { "v": 96, "ah": 120, "desc": "Véhicule utilitaire léger" },
            { "v": 350, "ah": 150, "desc": "Batterie EV (Berline)" },
            { "v": 400, "ah": 230, "desc": "Batterie EV (SUV/Haut de gamme)" }
        ]
    },

    "nicd": {
        "label": "Nickel-Cadmium",
        "options": [
            { "v": 1.2, "ah": 1.2, "desc": "Format AA industriel" },
            { "v": 1.2, "ah": 4.5, "desc": "Format D industriel" },
            { "v": 1.2, "ah": 20, "desc": "Cellule KH (Stationnaire)" },
            { "v": 1.2, "ah": 50, "desc": "Cellule KPL (Basse décharge)" },
            { "v": 1.2, "ah": 80, "desc": "Cellule KPM (Moyenne décharge)" },
            { "v": 1.2, "ah": 100, "desc": "Cellule KPH (Haute décharge)" },
            { "v": 1.2, "ah": 250, "desc": "Usage ferroviaire" },
            { "v": 1.2, "ah": 500, "desc": "Gros stockage industriel" },
            { "v": 1.2, "ah": 1200, "desc": "Capacité géante (Centrale)" },
            { "v": 12, "ah": 40, "desc": "Bloc démarrage turbine" },
            { "v": 12, "ah": 100, "desc": "Bloc secours hôpital" },
            { "v": 24, "ah": 50, "desc": "Système embarqué marine" },
            { "v": 24, "ah": 120, "desc": "Backup Pétrolier / Gazier" },
            { "v": 48, "ah": 100, "desc": "Télécoms désertiques" },
            { "v": 48, "ah": 200, "desc": "Backup réseau critique" },
            { "v": 96, "ah": 60, "desc": "Ascenseurs / Sécurité" },
            { "v": 110, "ah": 150, "desc": "Sous-station électrique" },
            { "v": 120, "ah": 200, "desc": "Contrôle-commande ferroviaire" }
        ]
    }
};
