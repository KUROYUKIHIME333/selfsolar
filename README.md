# SelfSolar API

API backend pour le dimensionnement automatique d'installations photovoltaïques, conforme aux normes internationales (NFC 15-100, IEC 61215, IEC 62109, etc.); développée en Node.js/TypeScript avec Fastify. 
Elle intègre des données météorologiques via PVGIS, même si je ne suis pas encore satisfait de cette partie.

### Fonctionnalités Principales

- **Dimensionnement complet** : Calcul automatique de la puissance PV, modules, stockage, câblage selon la consommation et le site.
- **Support multi-systèmes** : On-grid, off-grid, hybride, pompage solaire.
- **Intégration PVGIS** : Données d'irradiation solaire précises pour dimensionnement conservateur.
- **Normes conformes** : Calculs basés principalement sur NFC 15-100, IEC 61215, IEC 62109 et NF EN 50549 (même si je fait quelques calculs et logiques perso)
- **Documentation interactive** : Swagger UI pour explorer et tester l'API.
- **Listes de composants** : Accès à une liste de panneaux PV et batteries.

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
   # Éditer .env avec vos valeurs (dont l'url de l'api PVGIS_URL)
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

## Utilisation

L'API écoute sur `http://localhost:5001` par défaut.

- **Documentation Swagger** : `http://localhost:5001/documentation/`
- **Spécification OpenAPI** : `http://localhost:5001/api-spec.json`

### Tests

Scripts de test pour différents scénarios :
```bash
npm run test
```

## Structure du Projet après tout ça, normalement

```
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── package-lock.json
    ├── package.json
    ├── README.md
    ├── tsconfig.json
    ├── vitest.config.ts
    └── src/
        ├── server.ts              # Point d'entrée serveur
        ├── app.ts                 # Configuration Fastify
        ├── controllers/
        │   ├── installationPhotovoltaique.controllers.ts
        │   └── ...
        ├── config/
        │   ├── auth.ts
        │   └── db.ts
        ├── db/
        │   └── sqlSchemas.sql
        ├── hooks/
        ├── plugins/
        ├── routes/
        │   ├── api.routes.ts
        │   ├── installationPhotovoltaique.routes.ts
        │   └── ...
        ├── services/
        │   ├── installationPhotovoltaique/
        │   │   ├── bilanConso.services.ts
        │   │   ├── parametreSite.services.ts
        │   │   ├── puissancePVCrete.services.ts
        │   │   ├── stockage.services.ts
        │   │   └── cablageProtection.services.ts
        │   └── ...
        ├── types/
        │   ├── installationPhotovoltaique.types.ts
        │   └── ...
        ├── tests/
        │   └── unitary/
        │       ├── installationPhotovoltaique/
        |       |   ├── bilanConsommation.tests.ts
        |       |   ├── cablageProtection.tests.ts
        |       |   ├── parametreSite.tests.ts
        |       |   └── ...
        │       └── ...
        └── utils/
            ├── batteriesListe.utils.ts
            ├── constantesPhysiques.utils.ts
            └── ...
```

## API Endpoints


- `GET /api/v1/pv/liste-panneaux` : Liste des panneaux PV
- `GET /api/v1/pv/liste-batteries` : Liste des batteries
- `GET /api/v1/pv/listes` : Listes combinées
- `GET /api/v1/pv/sante` : État des services


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