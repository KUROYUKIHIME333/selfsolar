# SelfSolar API

API backend pour le dimensionnement automatique d'installations photovoltaïques, conforme aux normes internationales (NFC 15-100, IEC 61215, IEC 62109, etc.).

## Description

SelfSolar est une API REST développée en Node.js/TypeScript avec Fastify, spécialisée dans le calcul automatique des composants optimaux pour des installations solaires : modules PV, onduleurs, batteries, câblage et protections. Elle intègre des données météorologiques via PVGIS et respecte les normes électriques européennes et internationales pour garantir sécurité et efficacité.

### Fonctionnalités Principales

- **Dimensionnement complet** : Calcul automatique de la puissance PV, modules, stockage, câblage selon la consommation et le site.
- **Support multi-systèmes** : On-grid, off-grid, hybride, pompage solaire.
- **Intégration PVGIS** : Données d'irradiation solaire précises pour dimensionnement conservateur.
- **Normes conformes** : Calculs basés sur NFC 15-100, IEC 61215, IEC 62109, NF EN 50549, etc.
- **Documentation interactive** : Swagger UI pour explorer et tester l'API.
- **Listes de composants** : Accès aux bases de données de panneaux PV et batteries.

## Installation

### Prérequis

- Node.js >= 18
- npm ou yarn
- Variables d'environnement (voir `.env.example`)

### Étapes

1. Cloner le repository :
   ```bash
   git clone https://github.com/KUROYUKIHIME333/selfsolar.git
   cd selfsolar
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Configurer les variables d'environnement :
   ```bash
   cp .env.example .env
   # Éditer .env avec vos valeurs (PVGIS_URL, etc.)
   ```

4. Construire et démarrer en mode développement :
   ```bash
   npm run dev
   ```

5. Pour production :
   ```bash
   npm run build
   npm run start:prod
   ```

### Docker

```bash
npm run docker:build
npm run docker:run
```

## Utilisation

L'API écoute sur `http://localhost:3000` par défaut.

- **Documentation Swagger** : `http://localhost:3000/documentation/`
- **Spécification OpenAPI** : `http://localhost:3000/api-spec.json`

### Exemple de Requête

Endpoint principal : `POST /api/v1/pv/dimensionner`

```json
{
  "localisation": {
    "lat": 48.8566,
    "long": 2.3522
  },
  "equipements": [
    {
      "nom": "Réfrigérateur",
      "P": 150,
      "h": 8,
      "ks": 0.8
    }
  ],
  "typeInstallation": "STANDARD",
  "typeSysteme": "off-grid",
  "parametresPanneau": {
    "puissanceCreteModule": 400,
    "tensionMPP": 40.5,
    "tensionVoc": 49.2,
    "courantMPP": 9.88,
    "courantCourtCircuit": 10.5,
    "coeffTempTension": 0.0035,
    "coeffTempPuissance": 0.004,
    "noct": 45
  },
  "temperaturesAttendue": {
    "temperatureMin": -5,
    "temperatureMax": 35
  },
  "autonomieBatterie": 3,
  "technologieBatterie": "LiFePO4",
  "irradianceMax": 1000
}
```

### Tests

Scripts de test pour différents scénarios :
```bash
npm run test:ongrid
npm run test:offgrid
npm run test:hybride
npm run test:pompage
npm run test:all
```

## API Endpoints

- `POST /api/v1/pv/dimensionner` : Dimensionnement complet
- `GET /api/v1/pv/liste-panneaux` : Liste des panneaux PV
- `GET /api/v1/pv/liste-batteries` : Liste des batteries
- `GET /api/v1/pv/listes` : Listes combinées
- `GET /api/v1/pv/sante` : État des services

## Structure du Projet

```
src/
├── app.ts                 # Configuration Fastify
├── server.ts              # Point d'entrée serveur
├── controllers/
│   └── installationPhotovoltaique.controllers.ts
├── routes/
│   ├── api.routes.ts
│   └── installationPhotovoltaique.routes.ts
├── services/
│   ├── installationPhotovoltaique/
│   │   ├── bilanConso.services.ts
│   │   ├── parametreSite.services.ts
│   │   ├── puissancePVCrete.services.ts
│   │   ├── stockage.services.ts
│   │   └── cablageProtection.services.ts
│   └── ...
├── types/
│   └── installationPhotovoltaique.types.ts
└── utils/
    ├── batteriesListe.utils.ts
    └── constantesPhysiques.utils.ts
```

## Technologies

- **Runtime** : Node.js
- **Langage** : TypeScript
- **Framework** : Fastify
- **Documentation** : Swagger/OpenAPI
- **Authentification** : JWT (optionnel)
- **Données externes** : PVGIS API
- **Normes** : NFC 15-100, IEC 61215, IEC 62109, etc.

## Contribution

1. Forker le repository
2. Créer une branche feature (`git checkout -b feature/nouvelle-fonction`)
3. Commiter les changements (`git commit -am 'Ajout nouvelle fonction'`)
4. Pousser la branche (`git push origin feature/nouvelle-fonction`)
5. Ouvrir une Pull Request

### Développement

- `npm run lint` : Vérification TypeScript
- `npm run build` : Compilation
- `npm run dev` : Développement avec rechargement automatique

## Licence

ISC

## Contact

Repository : [https://github.com/KUROYUKIHIME333/selfsolar](https://github.com/KUROYUKIHIME333/selfsolar)