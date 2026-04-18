# Guide d'Utilisation API - Dimensionnement Photovoltaïque

## Base URL

```
http://localhost:3000/api/v1/pv
```

## Endpoints Disponibles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/sante` | Vérification état des services |
| GET | `/normes-reference` | Liste des normes applicables |
| POST | `/dimensionner` | **Dimensionnement complet installation PV** |

---

## 1. Vérification Santé

### Requête

```bash
curl -X GET http://localhost:3000/api/v1/pv/sante
```

### Réponse

```json
{
  "status": "opérationnel",
  "services": {
    "bilanConso": "actif",
    "parametresSite": "actif",
    "puissancePV": "actif",
    "stockage": "actif",
    "cablageProtections": "actif"
  },
  "normesReference": [
    "NF C 15-100",
    "IEC 61215",
    "IEC 62109",
    "NF EN 50549",
    "ISO 8528",
    "IEC 62619",
    "IEC 61643-31"
  ],
  "version": "2.0.0"
}
```

---

## 2. Dimensionnement Complet - Cas d'Usage

### Cas 1: Installation On-Grid (Raccordée Réseau)

**Scénario**: Maison individuelle en France, toiture sud, 6kWc cible

```bash
curl -X POST http://localhost:3000/api/v1/pv/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation": {
      "lat": 45.75,
      "long": 4.85,
      "altitude": 200
    },
    "equipements": [
      { "nom": "Éclairage LED", "P": 300, "h": 6, "ks": 0.6 },
      { "nom": "Réfrigérateur", "P": 150, "h": 24, "ks": 0.35 },
      { "nom": "TV + Box", "P": 200, "h": 5, "ks": 0.8 },
      { "nom": "Lave-linge", "P": 2200, "h": 1, "ks": 0.3 },
      { "nom": "Ordinateurs", "P": 400, "h": 8, "ks": 0.7 },
      { "nom": "Climatisation", "P": 2500, "h": 4, "ks": 0.5 }
    ],
    "facteurFoisonnementGlobal": 0.8,
    "typeInstallation": "STANDARD",
    "typeSysteme": "on-grid",
    "parametresPanneau": {
      "puissanceCreteModule": 450,
      "tensionVoc": 41.2,
      "courantCourtCircuit": 13.85,
      "tensionMPP": 34.8,
      "courantMPP": 12.93,
      "coeffTempTension": 0.0031,
      "coeffTempPuissance": 0.0035,
      "noct": 45
    },
    "temperaturesAttendue": {
      "temperatureMin": -10,
      "temperatureMax": 45
    },
    "contraintesOnduleur": {
      "puissanceACNominale": 6000,
      "tensionDCMax": 1000,
      "tensionMPPTMin": 200,
      "tensionMPPTMax": 850,
      "courantDCMax": 30,
      "puissanceDCMax": 9000,
      "rendementMPPT": 0.985
    },
    "cablage": {
      "materiau": "cuivre",
      "longueurString": 20,
      "longueurPrincipalDC": 15,
      "longueurAC": 10,
      "methodePoseDC": "conduit_surface",
      "methodePoseAC": "conduit_encastre",
      "conditionEnvironnement": "chaud"
    },
    "irradianceMax": 1200
  }'
```

---

### Cas 2: Installation Off-Grid Autonome (Site Isolé)

**Scénario**: Cabane en montagne, pas de réseau, 3 jours d'autonomie

```bash
curl -X POST http://localhost:3000/api/v1/pv/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation": {
      "lat": 44.65,
      "long": 6.07,
      "altitude": 1200
    },
    "equipements": [
      { "nom": "Éclairage LED 12V", "P": 60, "h": 5, "ks": 0.8 },
      { "nom": "Réfrigérateur 12V", "P": 80, "h": 24, "ks": 0.4 },
      { "nom": "Pompe eau 12V", "P": 200, "h": 2, "ks": 0.6 },
      { "nom": "Chargeur téléphones", "P": 25, "h": 3, "ks": 1.0 },
      { "nom": "Radio", "P": 15, "h": 4, "ks": 0.5 }
    ],
    "facteurFoisonnementGlobal": 0.85,
    "typeInstallation": "HAUTE_QUALITE",
    "typeSysteme": "off-grid",
    "parametresPanneau": {
      "puissanceCreteModule": 200,
      "tensionVoc": 24.3,
      "courantCourtCircuit": 10.5,
      "tensionMPP": 20.4,
      "courantMPP": 9.8,
      "coeffTempTension": 0.0033,
      "coeffTempPuissance": 0.0040,
      "noct": 47
    },
    "temperaturesAttendue": {
      "temperatureMin": -15,
      "temperatureMax": 35
    },
    "autonomieBatterie": 3,
    "technologieBatterie": "LiFePO4",
    "tensionSystemeBatterie": 48,
    "cablage": {
      "materiau": "cuivre",
      "longueurString": 10,
      "longueurPrincipalDC": 5,
      "longueurAC": 8,
      "methodePoseDC": "air_libre",
      "methodePoseAC": "conduit_encastre",
      "conditionEnvironnement": "standard"
    },
    "irradianceMax": 1100
  }'
```

---

### Cas 3: Installation Hybride (PV + Batterie + Réseau Backup)

**Scénario**: Commerce avec stockage pour effacement tarifaire et secours

```bash
curl -X POST http://localhost:3000/api/v1/pv/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation": {
      "lat": 43.3,
      "long": 5.4
    },
    "equipements": [
      { "nom": "Éclairage boutique", "P": 800, "h": 12, "ks": 0.7 },
      { "nom": "Vitrine réfrigérée", "P": 1500, "h": 14, "ks": 0.9 },
      { "nom": "Caisse enregistreuse", "P": 200, "h": 10, "ks": 1.0 },
      { "nom": "Climatisation", "P": 3500, "h": 6, "ks": 0.6 },
      { "nom": "Ordinateur bureau", "P": 300, "h": 8, "ks": 0.8 }
    ],
    "facteurFoisonnementGlobal": 0.75,
    "typeInstallation": "HAUTE_QUALITE",
    "typeSysteme": "hybride",
    "parametresPanneau": {
      "puissanceCreteModule": 550,
      "tensionVoc": 49.5,
      "courantCourtCircuit": 14.2,
      "tensionMPP": 41.6,
      "courantMPP": 13.22,
      "coeffTempTension": 0.0029,
      "coeffTempPuissance": 0.0034,
      "noct": 44
    },
    "temperaturesAttendue": {
      "temperatureMin": -5,
      "temperatureMax": 40
    },
    "contraintesOnduleur": {
      "puissanceACNominale": 10000,
      "tensionDCMax": 1100,
      "tensionMPPTMin": 250,
      "tensionMPPTMax": 1000,
      "courantDCMax": 40,
      "puissanceDCMax": 15000,
      "puissanceSurcharge": 15000,
      "rendementMPPT": 0.99,
      "tensionBatterieMin": 42,
      "tensionBatterieMax": 58,
      "puissanceChargeBatterieMax": 5000
    },
    "autonomieBatterie": 4,
    "technologieBatterie": "LiFePO4",
    "cablage": {
      "materiau": "cuivre",
      "longueurString": 25,
      "longueurPrincipalDC": 12,
      "longueurAC": 15,
      "methodePoseDC": "gaine_technique",
      "methodePoseAC": "conduit_encastre",
      "conditionEnvironnement": "chaud"
    },
    "irradianceMax": 1150
  }'
```

---

### Cas 4: Pompage Solaire Direct (Sans Batterie)

**Scénario**: Irrigation agricole, pompage direct jour uniquement

```bash
curl -X POST http://localhost:3000/api/v1/pv/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation": {
      "lat": 14.7,
      "long": -17.5
    },
    "equipements": [
      { "nom": "Pompe irrigation", "P": 3000, "h": 6, "ks": 1.0 }
    ],
    "typeInstallation": "STANDARD",
    "typeSysteme": "off-grid",
    "parametresPanneau": {
      "puissanceCreteModule": 600,
      "tensionVoc": 45.8,
      "courantCourtCircuit": 16.8,
      "tensionMPP": 38.2,
      "courantMPP": 15.7,
      "coeffTempTension": 0.0030,
      "coeffTempPuissance": 0.0036,
      "noct": 46
    },
    "temperaturesAttendue": {
      "temperatureMin": 15,
      "temperatureMax": 50
    },
    "pompageSolaire": true,
    "pompageCaracteristiques": {
      "batteries": false,
      "masseVolumique": 1000,
      "accelerationPesanteur": 9.81,
      "debit": 50,
      "hauteurMano": 25,
      "rendementPompe": 0.65
    },
    "tensionSystemeBatterie": 48,
    "cablage": {
      "materiau": "aluminium",
      "longueurString": 50,
      "longueurPrincipalDC": 30,
      "methodePoseDC": "enterre",
      "conditionEnvironnement": "extreme"
    },
    "irradianceMax": 1200
  }'
```

---

### Cas 5: Installation en Zone Tropicale Chaude (Dé-rating)

**Scénario**: RDC, forte chaleur, poussière, matériel aluminium

```bash
curl -X POST http://localhost:3000/api/v1/pv/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation": {
      "lat": -4.3,
      "long": 15.3
    },
    "equipements": [
      { "nom": "Éclairage", "P": 500, "h": 8, "ks": 0.7 },
      { "nom": "Climatisation", "P": 4000, "h": 10, "ks": 0.8 },
      { "nom": "Congélateur", "P": 300, "h": 24, "ks": 0.5 },
      { "nom": "Pompe", "P": 750, "h": 4, "ks": 0.6 }
    ],
    "typeInstallation": "POUSSIEREUX",
    "typeSysteme": "hybride",
    "parametresPanneau": {
      "puissanceCreteModule": 540,
      "tensionVoc": 49.8,
      "courantCourtCircuit": 13.85,
      "tensionMPP": 41.6,
      "courantMPP": 12.97,
      "coeffTempTension": 0.0028,
      "coeffTempPuissance": 0.0034,
      "noct": 45
    },
    "temperaturesAttendue": {
      "temperatureMin": 20,
      "temperatureMax": 55
    },
    "contraintesOnduleur": {
      "puissanceACNominale": 8000,
      "tensionDCMax": 1100,
      "tensionMPPTMin": 200,
      "tensionMPPTMax": 1000,
      "courantDCMax": 32,
      "puissanceDCMax": 12000,
      "rendementMPPT": 0.98
    },
    "autonomieBatterie": 2,
    "technologieBatterie": "LiFePO4",
    "cablage": {
      "materiau": "aluminium",
      "longueurString": 35,
      "longueurPrincipalDC": 20,
      "longueurAC": 12,
      "methodePoseDC": "conduit_surface",
      "methodePoseAC": "conduit_encastre",
      "conditionEnvironnement": "extreme"
    },
    "irradianceMax": 1250
  }'
```

---

### Cas 6: Petite Installation 12V (Cabane, Camping)

**Scénario**: Système 12V simple, peu de puissance

```bash
curl -X POST http://localhost:3000/api/v1/pv/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation": {
      "lat": 48.85,
      "long": 2.35
    },
    "equipements": [
      { "nom": "LED camping", "P": 20, "h": 4, "ks": 0.9 },
      { "nom": "Chargeur USB", "P": 15, "h": 3, "ks": 0.8 },
      { "nom": "Petit ventilateur", "P": 25, "h": 6, "ks": 0.6 }
    ],
    "typeInstallation": "HAUTE_QUALITE",
    "typeSysteme": "off-grid",
    "parametresPanneau": {
      "puissanceCreteModule": 100,
      "tensionVoc": 22.6,
      "courantCourtCircuit": 5.8,
      "tensionMPP": 18.4,
      "courantMPP": 5.43,
      "coeffTempTension": 0.0034,
      "coeffTempPuissance": 0.0040,
      "noct": 48
    },
    "temperaturesAttendue": {
      "temperatureMin": -5,
      "temperatureMax": 35
    },
    "autonomieBatterie": 2,
    "technologieBatterie": "AGM/Gel",
    "tensionSystemeBatterie": 12,
    "cablage": {
      "materiau": "cuivre",
      "longueurString": 8,
      "longueurPrincipalDC": 3,
      "longueurAC": 5,
      "methodePoseDC": "air_libre",
      "conditionEnvironnement": "standard"
    },
    "irradianceMax": 1000
  }'
```

---

## 3. Structure de Réponse

### Exemple de Réponse Complète

```json
{
  "resume": {
    "energieJournaliere_Wh": 8750,
    "puissanceCreteCharge_W": 2850,
    "puissanceCretePV_Wc": 4500,
    "ratioDCAC": 1.15,
    "surfaceEstimee_m2": 22,
    "nombreStrings": 2
  },
  "site": {
    "localisation": {
      "lat": 45.75,
      "long": 4.85,
      "altitude": 200
    },
    "angleOptimal": {
      "hemisphère": "N",
      "orientation": "S",
      "angle": 35
    },
    "PSH_moisDefavorable": 2.1,
    "performanceRatio": 0.82,
    "pertesTotales_pourcent": 18
  },
  "modulesPV": {
    "appareil": "panneaux photovoltaiques",
    "configuration": "haute_tension",
    "panneauxParString": 10,
    "stringsEnParallele": 2,
    "totalPanneaux": 20,
    "tensionStringSTC": 348,
    "tensionStringMin": 298.5,
    "tensionStringMax": 397.2,
    "vocStringFroid": 412.0,
    "puissancePVInstallee": {
      "min": 4140,
      "max": 4500
    },
    "_temperaturesCellule": {
      "tCellMin": 8.2,
      "tCellMax": 65.0
    },
    "_tensionModuleCorrigee": {
      "mppMin": 29.85,
      "mppMax": 39.72,
      "vocFroid": 41.2
    }
  },
  "onduleur": {
    "appareil": "onduleur",
    "typeSysteme": "on-grid",
    "grandeursChamp": {
      "tCellMin": 8.2,
      "tCellMax": 65.0,
      "vocChampFroid": 412.0,
      "vmppChampChaud": 298.5,
      "vmppNominal": 348.0,
      "iscChamp": 27.7,
      "puissanceChampsWc": 4500
    },
    "dimensionnement": {
      "puissanceACMin": 3214,
      "puissanceACRecommandee": 3913,
      "puissanceACMax": 4500,
      "ratioDCAC": 1.15,
      "evaluationRatio": "optimal"
    },
    "verification": {
      "compatible": true,
      "details": {
        "vocSousLimite": true,
        "vmppAuDessusMinimum": true,
        "vmppDansPlageMPPT": true,
        "iscSousLimite": true,
        "puissanceDCOk": true,
        "chargeACOk": true,
        "surchargeOk": null
      }
    },
    "avertissements": [],
    "erreurs": []
  },
  "stockage": null,
  "cablage": {
    "dc": {
      "cablesString": [
        {
          "section": 4,
          "materiau": "cuivre",
          "typeCable": "H1Z2Z2-K",
          "courantAdmissible": 24.64,
          "courantDimensionnement": 17.31,
          "resistanceLineique": 4.465,
          "chuteTensionV": 3.09,
          "chuteTensionPourcent": 0.89,
          "chuteTensionMax": 1.0,
          "longueur": 20,
          "nombreConducteurs": 2,
          "temperatureAmbiante": 40,
          "temperatureConducteur": 60,
          "methodePose": "conduit_surface",
          "facteursCorrection": {
            "kT": 0.87,
            "kG": 1.0,
            "kP": 0.8,
            "kM": 1.0,
            "total": 0.7
          }
        }
      ],
      "cablePrincipalDC": {
        "section": 10,
        "materiau": "cuivre",
        "typeCable": "H1Z2Z2-K",
        "courantAdmissible": 39.9,
        "courantDimensionnement": 27.7,
        "resistanceLineique": 1.786,
        "chuteTensionV": 9.9,
        "chuteTensionPourcent": 1.85,
        "chuteTensionMax": 2.0,
        "longueur": 15,
        "nombreConducteurs": 2,
        "temperatureAmbiante": 40,
        "temperatureConducteur": 60,
        "methodePose": "conduit_surface",
        "facteursCorrection": {
          "kT": 0.87,
          "kG": 0.8,
          "kP": 0.8,
          "kM": 1.0,
          "total": 0.56
        }
      },
      "protectionsString": [
        {
          "type": "fusible",
          "calibre": 20,
          "tensionAssignee": 495,
          "pouvoirCoupure": 10,
          "norme": "IEC 60269-6",
          "emplacement": "Boîte de jonction DC - 2 strings",
          "caracteristiques": "gPV - fusible photovoltaïque 20A"
        }
      ],
      "protectionOnduleurDC": [
        {
          "type": "sectionneur",
          "tensionAssignee": 495,
          "norme": "IEC 60947-3",
          "emplacement": "Entrée onduleur DC - coupure maintenance",
          "caracteristiques": "Un ≥ 495V, In ≥ 35A, coupure visible sous charge"
        }
      ],
      "parafoudreDC": {
        "type": "parafoudre",
        "tensionAssignee": 495,
        "norme": "IEC 61643-31",
        "emplacement": "Entrée onduleur DC",
        "caracteristiques": "Type 2 (Imax 5kA 8/20μs) - Up ≤ 2.0kV, Uc ≥ 495V"
      },
      "sectionsStandardUtilisees": [4, 10],
      "verificationChuteTensionGlobale": true,
      "avertissements": []
    },
    "ac": {
      "section": 16,
      "materiau": "cuivre",
      "courantEmploi": 17.04,
      "courantAdmissible": 53.2,
      "protection": 20,
      "chuteTension": 0.68,
      "chuteTensionMax": 5.0,
      "ddr": {
        "type": "B",
        "sensibilite": 30,
        "norme": "IEC 62955 / NFC 15-100 §722 - RCD type B obligatoire onduleur"
      },
      "methodePose": "conduit_encastre",
      "facteursCorrection": {
        "kT": 1.0,
        "kP": 0.7,
        "kM": 1.0,
        "total": 0.7
      }
    }
  },
  "conformite": {
    "normesReference": [
      "NF C 15-100",
      "IEC 61215",
      "IEC 62109",
      "NF EN 50549",
      "IEC 62619",
      "IEC 61643-31"
    ],
    "verificationVoc": true,
    "verificationMPPT": true,
    "verificationIsc": true,
    "verificationChuteTension": true,
    "avertissements": [],
    "erreurs": []
  },
  "meta": {
    "timestamp": "2026-04-18T18:11:00.000Z",
    "versionCalculateur": "2.0.0-normes2024"
  }
}
```

---

## 4. Codes d'Erreur

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Données invalides ou dimensionnement impossible | Vérifier paramètres d'entrée, plages de valeurs |
| 400 | `Impossible de dimensionner: Ns_min > Ns_max` | Tension onduleur incompatible avec module, vérifier plage MPPT |
| 400 | `Section standard insuffisante` | Augmenter section, réduire longueur, ou changer matériau |
| 500 | Erreur interne serveur | Contacter support, vérifier logs |
| 503 | Service PVGIS indisponible | Réessayer plus tard, valeurs fallback utilisées |

---

## 5. Paramètres Clés par Type d'Installation

| Paramètre | On-Grid | Off-Grid | Hybride |
|-----------|---------|----------|---------|
| `typeSysteme` | `"on-grid"` | `"off-grid"` | `"hybride"` |
| `contraintesOnduleur` | **Requis** | Optionnel (si MPPT HT) | **Requis** |
| `autonomieBatterie` | Ignoré | **Requis** | **Requis** |
| `technologieBatterie` | Ignoré | **Requis** | **Requis** |
| `tensionSystemeBatterie` | Ignoré | 12/24/48V | Ignoré (onduleur définit) |
| `pompageSolaire` | false | Possible | false |

---

## 6. Matériaux Conducteurs

| Matériau | Avantage | Inconvénient | Usage typique |
|----------|----------|--------------|---------------|
| `cuivre` | Meilleure conductivité, souple | Plus cher | Standard, toutes sections |
| `aluminium` | Économique, léger | Section ×1.6, rigidité | Gros départs > 50mm², longues distances |

> **Note**: Aluminium = section équivalente × 1.6 pour même chute tension, ou utiliser facteur 0.78 sur courant admissible.

---

## 7. Conditions Environnementales

| Condition | Température | Impact | Usage |
|-----------|-------------|--------|-------|
| `standard` | 30°C | Aucun | Intérieur, climatisé |
| `chaud` | 40°C | kT = 0.87 | Standard toiture France |
| `tres_chaud` | 50°C | kT = 0.71 | Sud France, Italie |
| `extreme` | 60°C | kT = 0.50 | Afrique, désert, RDC |
| `humide` | - | Isolation renforcée | Tropiques humides |
| `corrosif` | - | Matériaux spéciaux | Bord de mer, industrie |

---

## 8. Outils de Test Rapide

### Script Bash (Linux/Mac)

```bash
#!/bin/bash

API_URL="http://localhost:3000/api/v1/pv"

# Test santé
echo "=== Test Santé ==="
curl -s $API_URL/sante | jq .

# Test dimensionnement simple
echo -e "\n=== Test On-Grid ==="
curl -s -X POST $API_URL/dimensionner \
  -H "Content-Type: application/json" \
  -d '{
    "localisation":{"lat":45.75,"long":4.85},
    "equipements":[{"nom":"Test","P":1000,"h":5,"ks":0.8}],
    "typeInstallation":"STANDARD",
    "typeSysteme":"on-grid",
    "parametresPanneau":{"puissanceCreteModule":400,"tensionVoc":40,"courantCourtCircuit":12,"tensionMPP":33,"coeffTempTension":0.003,"coeffTempPuissance":0.0035,"noct":45},
    "temperaturesAttendue":{"temperatureMin":-10,"temperatureMax":40},
    "contraintesOnduleur":{"puissanceACNominale":5000,"tensionDCMax":1000,"tensionMPPTMin":200,"tensionMPPTMax":850,"courantDCMax":25,"puissanceDCMax":7500}
  }' | jq '.resume, .conformite'
```

### PowerShell (Windows)

```powershell
$API = "http://localhost:3000/api/v1/pv"

# Test santé
Invoke-RestMethod -Uri "$API/sante" | ConvertTo-Json -Depth 3

# Test dimensionnement
$body = @{
    localisation = @{ lat = 45.75; long = 4.85 }
    equipements = @(@{ nom = "Test"; P = 1000; h = 5; ks = 0.8 })
    typeInstallation = "STANDARD"
    typeSysteme = "on-grid"
    parametresPanneau = @{
        puissanceCreteModule = 400
        tensionVoc = 40
        courantCourtCircuit = 12
        tensionMPP = 33
        coeffTempTension = 0.003
        coeffTempPuissance = 0.0035
        noct = 45
    }
    temperaturesAttendue = @{ temperatureMin = -10; temperatureMax = 40 }
    contraintesOnduleur = @{
        puissanceACNominale = 5000
        tensionDCMax = 1000
        tensionMPPTMin = 200
        tensionMPPTMax = 850
        courantDCMax = 25
        puissanceDCMax = 7500
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "$API/dimensionner" -Method POST -Body $body -ContentType "application/json"
```
