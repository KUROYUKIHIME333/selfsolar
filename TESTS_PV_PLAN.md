# 🧪 Plan de Test & Validation de l'API de Dimensionnement Photovoltaïque

Ce document décrit les cas de test unitaires par route ainsi qu'un workflow global d'intégration pour valider la logique métier et la robustesse de l'API.

---

## 1. Route : `POST /api/v1/pv/consommation-energetique`

### 🟢 Cas Passant 1 : Résidentiel Standard (Climatisation + Électroménager)
**Requête :**
```json
{
  "facteurFoisonnementGlobal": 0.75,
  "equipements": [
    { "nom": "Climatiseur Split", "P": 1200, "h": 6, "k": 3 },
    { "nom": "Réfrigérateur Combiné", "P": 250, "h": 24, "k": 5 },
    { "nom": "Éclairage LED x10", "P": 90, "h": 8, "k": 1 },
    { "nom": "Ordinateur + Écrans", "P": 300, "h": 5, "k": 1.2 }
  ]