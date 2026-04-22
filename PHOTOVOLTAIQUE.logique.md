# Théorie du Dimensionnement Photovoltaïque

## Introduction

Le dimensionnement d'une installation photovoltaïque (PV) est un processus critique qui vise à déterminer les composants optimaux (modules PV, onduleurs, batteries, câblage) pour répondre aux besoins énergétiques d'un site tout en respectant les normes de sécurité, d'efficacité et d'économie. Ce processus est essentiel pour garantir la viabilité technique et économique du système solaire, en évitant les surdimensionnements coûteux ou les sous-dimensionnements inefficaces.

### Pourquoi dimensionner correctement ?

- **Efficacité énergétique** : Assurer que la production PV couvre la consommation sans pertes excessives.
- **Sécurité** : Respecter les normes électriques (NFC 15-100, IEC) pour éviter les risques d'incendie, électrocution ou surchauffe.
- **Économie** : Optimiser les coûts d'investissement et de maintenance sur la durée de vie du système (20-30 ans).
- **Durabilité** : Contribuer à la transition énergétique en maximisant l'utilisation des ressources renouvelables.

Pour les professionnels (installateurs, ingénieurs), le dimensionnement repose sur des calculs normés et des données empiriques. Pour les scientifiques, il intègre des modèles physiques (thermodynamique, électrotechnique) et des données météorologiques (irradiation solaire).

## Étapes du Dimensionnement

Le processus suit une séquence logique, orchestrée par les services logiciels développés, basée sur les normes internationales.

### 1. Bilan de Consommation Électrique

**Objectif** : Évaluer la demande énergétique du site.

**Méthode** : Utilisation de la méthode des coefficients de simultanéité (NFC 15-100 §771).

- **Énergie journalière totale** :
  \[
  E_{\text{charge}} [\text{Wh/j}] = \sum (P_i \times h_i \times k_{s,i})
  \]
  Où :
  - \(P_i\) : Puissance nominale de l'équipement \(i\) (W)
  - \(h_i\) : Durée d'utilisation journalière (h/j)
  - \(k_{s,i}\) : Facteur de simultanéité (0-1)

- **Puissance de crête apparente** :
  \[
  P_{\text{crête}} = \sum (P_i \times k_{s,i}) \times K_f
  \]
  Où \(K_f\) est le facteur de foisonnement global (0.6-1.0, défaut 0.8).

**Justification** : Les équipements ne fonctionnent pas simultanément à pleine puissance. Le coefficient \(k_s\) et \(K_f\) tiennent compte de la diversité des usages.

### 2. Paramètres du Site et Ressource Solaire

**Objectif** : Déterminer l'exposition solaire et l'orientation optimale.

**Méthode** : Calcul de l'angle d'inclinaison optimal et récupération des données d'irradiation via PVGIS (API de la Commission Européenne).

- **Angle d'inclinaison optimal** (méthode simplifiée) :
  - Latitude < 15° : Quasi-horizontal (0-10°)
  - 15-25° : Angle = latitude
  - > 25° : Angle = 0.76 × latitude + 3.1

- **Peak Sun Hours (PSH)** : Heures équivalentes à 1 kW/m²/jour, calculées pour le mois le plus défavorable pour un dimensionnement conservateur.

**Justification** : L'irradiation solaire varie avec la latitude, la saison et les conditions météorologiques. PVGIS fournit des données précises basées sur des modèles satellitaires.

### 3. Performance Ratio (PR) et Pertes Système

**Objectif** : Évaluer les pertes globales du système PV.

**Méthode** : Estimation basée sur le type d'installation (qualité, maintenance, environnement).

- **PR** : Rapport entre l'énergie AC produite et l'énergie DC incidente (0.75-0.85 typique).
- Pertes incluent : Température, câblage, MPPT, poussière, vieillissement.

**Justification** : Le PR intègre toutes les inefficacités réelles, permettant un dimensionnement réaliste plutôt qu'idéal.

### 4. Puissance Crête PV Requise

**Objectif** : Calculer la puissance PV nécessaire.

**Formules** :
- Standard :
  \[
  P_{\text{PV}} = \frac{E_{\text{charge}}}{\text{PSH} \times \text{PR}}
  \]
- Pompage solaire :
  \[
  P_{\text{PV}} = \frac{E_{\text{hydraulique}}}{\text{PSH} \times \eta_{\text{onduleur}} \times \text{PR}}
  \]

**Justification** : La puissance doit couvrir la demande énergétique en tenant compte des pertes et de la variabilité solaire.

### 5. Dimensionnement des Modules PV

**Objectif** : Déterminer le nombre et la disposition des panneaux.

**Méthode** : Calcul basé sur les contraintes de l'onduleur (tension MPPT) ou du système batterie.

- **Disposition** : Modules en série (strings) et parallèle.
- **Vérifications** : Tension Voc max (conditions froides), Vmpp min (conditions chaudes), courants Isc.

**Formules clés** :
- Température de cellule (modèle NOCT) :
  \[
  T_{\text{cell}} = T_{\text{amb}} + \frac{\text{NOCT} - 20}{800} \times G
  \]
- Tension avec température :
  \[
  V = V_{\text{STC}} \times (1 + \beta \times (T_{\text{cell}} - 25))
  \]

**Justification** : Les modules doivent opérer dans les plages de l'onduleur pour maximiser l'efficacité MPPT.

### 6. Vérification de l'Onduleur

**Objectif** : Assurer la compatibilité avec les modules et la charge.

**Méthode** : Vérification du ratio DC/AC (1.15 typique), tensions MPPT, courants max.

**Justification** : L'onduleur transforme le DC en AC et gère la sécurité (IEC 62109).

### 7. Dimensionnement du Stockage (Batteries)

**Objectif** : Calculer la capacité de stockage pour l'autonomie.

**Formules** :
- Capacité utile :
  \[
  C_{\text{utile}} [\text{Wh}] = E_{\text{charge}} [\text{Wh/j}] \times N_{\text{aut}}
  \]
- Capacité nominale :
  \[
  C_{\text{nominale}} [\text{Wh}] = \frac{C_{\text{utile}}}{\text{DoD}_{\text{max}}}
  \]
- En Ah :
  \[
  C_{\text{Ah}} = \frac{C_{\text{nominale}} [\text{Wh}]}{U_{\text{batt}} [\text{V}]}
  \]

**Technologies** : Plomb-acide, LiFePO4, etc., avec dé-rating température pour plomb.

**Justification** : Le stockage assure la continuité en cas d'absence de soleil (IEC 62619).

### 8. Câblage et Protections

**Objectif** : Dimensionner les câbles et protections pour minimiser les pertes et assurer la sécurité.

**Méthode** : Calcul des sections selon NFC 15-100, IEC 60364.

- **Chute de tension** : ≤ 3% total.
- **Protections** : Fusibles, disjoncteurs, parafoudres (IEC 61643-31).

**Formules** :
- Section câble :
  \[
  S = \frac{\rho \times L \times I}{\Delta U \times U}
  \]
  Avec corrections température et méthode de pose.

**Justification** : Les câbles transportent l'énergie sans pertes excessives ; les protections évitent les surintensités.

## Normes et Références

- **Électriques** : NFC 15-100, IEC 60364.
- **Modules PV** : IEC 61215.
- **Onduleurs** : IEC 62109.
- **Injection réseau** : NF EN 50549.
- **Groupes électrogènes** : ISO 8528.
- **Batteries** : IEC 62619.
- **Parafoudres** : IEC 61643-31.

## Considérations pour Professionnels et Scientifiques

**Professionnels** : Utilisez des logiciels de simulation (PVGIS, PVSyst) pour valider les calculs. Tenez compte des conditions locales (poussière, humidité) et des évolutions futures de la consommation.

**Scientifiques** : Les modèles intègrent la thermodynamique (températures), l'électrotechnique (circuits DC/AC) et la météorologie (irradiation). Des améliorations possibles incluent l'IA pour prédire les consommations ou optimiser les MPPT en temps réel.

Ce dimensionnement assure un système PV robuste, efficient et conforme aux standards internationaux.