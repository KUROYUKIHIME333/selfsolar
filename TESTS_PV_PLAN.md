## 📌 1. Bilan de Consommation Énergétique
### `POST /api/v1/pv/consommation-energetique`
Calcule les totaux énergétiques et de puissance à partir de la liste des charges du client. Idéal pour générer des graphiques de répartition ou valider la puissance de l'onduleur.

#### 📤 Ce qu'il faut envoyer (Request Body)
* **`equipements`** (`Array`, requis) : Liste des récepteurs électriques.
  * `nom` (`string`, optionnel) : Libellé de l'appareil.
  * `P` (`number`, requis) : Puissance nominale de l'appareil en Watts ($P > 0$).
  * `h` (`number`, requis) : Durée d'utilisation quotidienne en heures ($0 \\le h \\le 24$).
  * `k` (`number`, optionnel, défaut: `1`) : Coefficient de surpuissance au démarrage (appel transitoire).
* **`facteurFoisonnementGlobal`** (`number`, optionnel, défaut: `0.8`) : Facteur de simultanéité globale ($0 < k_f \\le 1$).


Résultat du code
File guide_integration_frontend_pv.md created successfully.

```json
{
  "facteurFoisonnementGlobal": 0.75,
  "equipements": [
    { "nom": "Climatiseur Split 12k", "P": 1200, "h": 6, "k": 3 },
    { "nom": "Réfrigérateur Multi-portes", "P": 250, "h": 24, "k": 5 },
    { "nom": "Éclairage Salon LED", "P": 90, "h": 8, "k": 1 }
  ]
}
```

📥 Ce qu'on reçoit (Response Body - 200 OK)



```JSON
{
  "success": true,
  "error": null,
  "data": {
    "energieJournaliereWh": 13920,
    "puissanceAppeleeW": 1155,
    "puissanceInstalleeW": 1540,
    "puissancePicW": 4940
  }
}
```

### 💡 Conseils d'intégration UX & Graphiques :
●	Graphique de répartition (Donut/Pie Chart) : Utilisez le tableau equipements pour calculer la part de chaque appareil dans l'énergie totale consommée via la formule $E_i = P_i \times h_i$ afin d'afficher aux utilisateurs quels appareils pèsent le plus sur leur facture.
●	Alerte Transitoire : Si puissancePicW est supérieure à 3 fois puissanceAppeleeW, affichez une pastille d'avertissement à l'utilisateur : "Vos équipements de type moteur (compresseurs, climatisation) génèrent de forts courants d'appel. Un onduleur robuste sera requis."

---

## 📌 2. Analyse Météorologique et Géographique
### `POST /api/v1/pv/donnees-meteo`

Interroge la base de données européenne PVGIS pour en extraire l'irradiation optimale ou applique des données de repli mathématiques.
📤 Ce qu'il faut envoyer (Request Body)



```JSON
{
  "localisation": {
    "lat": -4.322,
    "long": 15.307,
    "altitude": 280
  }
}
```

📥 Ce qu'on reçoit (Response Body - 200 OK)

```JSON
{
  "success": true,
  "error": null,
  "data": {
    "localisation": {
      "lat": -4.322,
      "long": 15.307,
      "altitude": 280
    },
    "orientation": "N",
    "angle": 12,
    "angleOptimal": 12,
    "months": [
      { "month": 1, "irradiation": 4.52 },
      { "month": 2, "irradiation": 4.61 }
    ],
    "moisDefavorable": "7",
    "moisSurfavorable": "3",
    "isFallback": false,
    "climateCorrection": {
      "dT": 1.25,
      "dGPercent": 4.2,
      "targetYear": 2040,
      "fraction": 0.85
    }
  }
}
```

### 💡 Conseils d'intégration UX & Graphiques :
●	Graphique Gisement Solaire (Bar/Line Chart) : Cartographiez le tableau months (Axe X : Mois de Janvier à Décembre, Axe Y : irradiation en $kWh/m^2/jour$). Mettez en surbrillance rouge le moisDefavorable pour expliquer visuellement la base de calcul du dimensionnement "pire des cas".
●	Visualisation 3D / Boussole : Utilisez orientation ("N", "S") et angle (en degrés) pour afficher une boussole ou une icône de toit incliné dynamique indiquant au technicien installateur vers où orienter physiquement les structures de fixation.

---

## 📌 3. Dimensionnement de la Puissance Crête
### `POST /api/v1/pv/puissance-crete`

Calcule le nombre de modules photovoltaïques et la puissance crête totale requise.
📤 Ce qu'il faut envoyer (Request Body)



```JSON
{
  "energieJournaliereWh": 13920,
  "psh": 4.2,
  "typeInstallation": "STANDARD",
  "facteurCorrectionClimatique": 0.95
}
```

📥 Ce qu'on reçoit (Response Body - 200 OK)

```
JSON
### {
  "success": true,
  "error": null,
  "data": {
    "puissanceCreteWc": 4366.45,
    "performanceRatio": 0.75,
    "pertesGlobalesPercent": 25,
    "detailsPertes": {
      "temperature": 10.5,
      "cablage": 3.0,
      "poussiere": 5.0,
      "onduleur": 6.5
    }
  }
}
```

### 💡 Conseils d'intégration UX & Graphiques :
●	Graphique en Cascade (Waterfall Chart) : Idéal pour illustrer le passage de la puissance théorique à la puissance réelle en affichant l'impact successif des valeurs de detailsPertes (pertes thermiques, salissures, rendements d'onduleurs). Cela justifie l'achat d'un plus grand nombre de panneaux auprès du client final.

---

## 📌 4. Vérification et Sélection de l'Onduleur
### `POST /api/v1/pv/onduleur`

Valide si la configuration de strings (chaînes de modules) ne va pas détruire ou brider l'onduleur sélectionné.
📤 Ce qu'il faut envoyer (Request Body)

```JSON
{
  "typeSysteme": "hybride",
  "panneauParametres": {
    "vmp": 41.5, "voc": 49.2, "imp": 13.26, "isc": 14.02, "pmax": 550, "kvoc": -0.27, "kpmax": -0.35
  },
  "onduleurParametres": {
    "vmax": 1000, "vminMppt": 200, "vmaxMppt": 850, "pNominalAC": 5000, "iscMaxMppt": 15
  },
  "configurationTension": {
    "nbModulesEnSerie": 12,
    "nbStringsParMppt": 1
  },
  "temperatureMinMax": {
    "tMin": 10,
    "tMax": 45
  }
}
```

📥 Ce qu'on reçoit (Response Body - 200 OK)

```JSON
{
  "success": true,
  "error": null,
  "data": {
    "appareil": "onduleur",
    "typeSysteme": "hybride",
    "grandeursChamp": {
      "vocChampFroid": 612.3,
      "vmppChampChaud: "452.1",
      "iscChamp": 14.02,
      "puissanceChampsWcSTC": 6600
    },
    "dimensionnement": {
      "ratioDCAC": 1.32,
      "evaluationRatio": "acceptable"
    },
    "verification": {
      "compatible": true,
      "respectPlageTension": true,
      "respectCourantMax": true,
      "respectPuissanceMax": true,
      "avertissements": ["Le ratio DC/AC de 1.32 implique un léger écrêtage lors des pointes d'irradiance."],
      "erreurs": []
    }
  }
}
```

### 💡 Conseils d'intégration UX & Graphiques :
●	Jauges Linéaires de Sécurité (Gauges) : Rendre visuel le positionnement des grandeurs du champ dans les plages constructeurs.
○	Afficher une jauge pour la plage MPPT ($200\text{V} \rightarrow 850\text{V}$) et situer la valeur vmppChampChaud et vmppChampFroid au milieu.
○	Si compatible vaut false, passez le conteneur en rouge vif et bouclez sur le tableau erreurs sous forme de liste à puces d'alertes bloquantes.

---

## 📌 5. Capacité et Autonomie du Stockage (Batteries)
### `POST /api/v1/pv/stockage`

Calcule les dimensions du banc de batteries stationnaires.
📤 Ce qu'il faut envoyer (Request Body)

```JSON
{
  "energieJournaliereWh": 13920,
  "tensionSysteme": 48,
  "autonomieJours": 1,
  "technologieBatteries": "LiFePO4",
  "temperatureAmbiante": 25
}
```

📥 Ce qu'on reçoit (Response Body - 200 OK)

```JSON
{
  "success": true,
  "error": null,
  "data": {
    "capaciteUtileWh": 13920,
    "capaciteNominaleWh": 17400,
    "capaciteNominaleAh": 362.5,
    "parametresTechnologie": {
      "dodMax": 0.8,
      "rendementFaraday": 0.95
    }
  }
}
```

### 💡 Conseils d'intégration UX :
●	Sélecteur de Tension Intelligent : Si capaciteNominaleAh dépasse $600\text{ Ah}$, affichez une notification d'assistance : "Capacité élevée détectée. Pensez à augmenter la tension globale de votre système (passer de 24V à 48V) pour réduire l'intensité du courant et économiser sur les sections de câbles."

---

## 📌 6. Câblages et Protections Électriques
### `POST /api/v1/pv/cablage-protection`

Génère la nomenclature de câblage cuivre/alu et les calibres de fusibles/disjoncteurs.
📤 Ce qu'il faut envoyer (Request Body)

```JSON
{
  "resultatModules": {
    "puissanceTotaleWc": 6600,
    "vmpChamp": 498,
    "iscChamp": 14.02
  },
  "panneauParametres": {
    "isc": 14.02,
    "voc": 49.2
  },
  "longueurStringMeters": 20,
  "longueurPrincipalMeters": 15,
  "materiau": "cuivre"
}
```

📥 Ce qu'on reçoit (Response Body - 200 OK)

```JSON
{
  "success": true,
  "error": null,
  "data": {
    "cableDCString": {
      "section": 4,
      "chutePourcent": 0.65
    },
    "cableDCPrincipal": {
      "section": 6,
      "chutePourcent": 0.82
    },
    "protectionDC": {
      "calibreFusibleA": 20,
      "interrupteurSectionneurA": 32
    }
  }
}
```

### 💡 Conseils d'intégration UX :
●	Schéma Unifilaire Interactif : Utilisez ces données pour mapper dynamiquement les étiquettes de texte sur un schéma vectoriel SVG représentant l'installation. Le câble entre les panneaux et la boîte de jonction affichera automatiquement "Cuivre 4 mm²", et le symbole du fusible affichera "Fusible gPV 20A".

---

## ⚠️ Codes Erreurs Standards et Conduite UI
Chaque fois que success vaut false, le serveur n'interrompt pas brutalement la connexion avec une page blanche mais renvoie un contrat d'erreur standardisé de niveau 400 ou 500 :

```JSON
{
  "success": false,
  "message": "Le coefficient de simultanéité global (facteurFoisonnementGlobal) doit être compris entre 0 et 1.",
  "code": 400
}
```

## 🛠️ Intercepteur global recommandé (Axios / Fetch) :

```TypeScript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data;
    if (errorData && errorData.success === false) {
      // Déclenche une notification Toast rouge avec le message métier exact du serveur
      NotificationService.error(errorData.message || "Une erreur technique est survenue.");
    }
    return Promise.reject(error);
  }
);
```

"""