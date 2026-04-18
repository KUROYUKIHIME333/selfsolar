export type Equipement = {
    nom: string | null | undefined;
    P: number;      // Puissance nominale en W
    h: number;      // Durée d'utilisation en h/j
    ks: number;     // Facteur de simultanéité (0-1)
};

export type Localisation = {
    lat: number;    // Latitude (-90 à 90)
    long: number;   // Longitude (-180 à 180)
    altitude?: number; // m (pour déclassement)
};

export type TypeInstallationPourPertes =
    | "HAUTE_QUALITE"
    | "STANDARD"
    | "POUSSIEREUX"
    | "FAIBLE_MAINTENANCE"
    | "ANCIEN"
    | "CABLE_LONG";

export type TypeSystemePV = "on-grid" | "off-grid" | "hybride";

// PARAMETRES PANNEAU PV (STC)

export type ParametresSTCPanneau = {
    // Puissance et tension
    puissanceCreteModule: number;   // Pmax (Wp) - Puissance en point MPP en STC
    tensionMPP: number;             // Vmpp (V) - Tension au point de puissance max
    tensionVoc: number;             // Voc (V) - Tension circuit ouvert

    // Courants
    courantMPP: number;             // Impp (A) - Courant au point de puissance max
    courantCourtCircuit: number;    // Isc (A) - Courant max, dimensionne protections

    // Coefficients température (en valeur absolue /°C)
    // Ex: -0.35%/°C → 0.0035 /°C
    coeffTempTension: number;       // β (Voc) - Typique: -0.30 à -0.45 %/°C
    coeffTempPuissance: number;     // γ (Pmax) - Typique: -0.35 à -0.45 %/°C
    coeffTempCourant?: number;      // α (Isc) - Typique: +0.05 %/°C (optionnel)

    // Température nominale
    noct: number;                   // Nominal Operating Cell Temperature (°C)
    // Conditions: 800 W/m², 20°C ambiant, vent 1 m/s
    // Valeur typique: 45-48°C
};

export type TemperaturesMinMax = {
    temperatureMin: number;         // °C - Pour calcul Voc max (condition hiver)
    temperatureMax: number;         // °C - Pour calcul Vmpp min (condition été)
};

// POMPAGE SOLAIRE

export type PompageSolaireCaracteristiques = {
    batteries: boolean;             // Stockage ou pompage direct
    masseVolumique: number;         // ρ (kg/m³) - Eau: 1000 kg/m³
    accelerationPesanteur: number;    // g (m/s²) - Standard: 9.81 m/s²
    debit: number;                  // Q (m³/j) - Débit journalier requis
    hauteurMano: number;            // H_man (m) - Hauteur manométrique totale
    rendementPompe: number;         // η_pompe (0.4 - 0.7) - Rendement pompe
};

// CONTRAINTES ONDULEUR

export interface ParametresOnduleur {
    // Puissances
    puissanceACNominale: number;    // W - Puissance sortie AC nominale
    puissanceDCMax?: number;        // W - Puissance entrée DC max
    puissanceSurcharge?: number;    // W - Pic soutenable (démarrage moteurs)
    rendementMPPT?: number;         // %/100 - Rendement MPPT (0.96-0.99)

    // Tensions DC (critiques pour sécurité)
    tensionDCMax: number;           // V - Limite ABSOLUE (sécurité)
    tensionMPPTMin: number;         // V - Minimum pour fonctionnement MPPT
    tensionMPPTMax: number;         // V - Maximum plage MPPT

    // Courants
    courantDCMax: number;           // A - Courant entrée DC max par MPPT

    // Off-grid/hybride uniquement
    tensionBatterieMin?: number;     // V
    tensionBatterieMax?: number;     // V
    puissanceChargeBatterieMax?: number; // W
}

// Interface étendue pour le service modulesPV
export interface ContraintesOnduleurModules {
    tensionMPPTMin: number;
    tensionMPPTMax: number;
    tensionDCMax: number;
    rendementMPPT?: number;
}

// STOCKAGE

export type TechnologieBatterie =
    | "Plomb-acide"
    | "AGM/Gel"
    | "LiFePO4"
    | "Lithium NMC/NCA"
    | "NiCd";

export interface ResultatStockage {
    appareil: "Batteries";
    typeBatterie: TechnologieBatterie;
    DoDMax: number;                 // Profondeur décharge max (0.5-0.9)
    cyclesDoDMax: {
        min: number;
        max: number;
    };
    plageTemperatureFonctionnement: {
        min: number;
        max: number;                // ✅ CORRIGÉ: était min avant
    };
    capacite: {
        utile_Wh: number;
        nominale_Wh: number;
        nominale_Ah: number;
    };
    autonomieJours: number;
    temperatureDeratingApplique: boolean;
    disposition?: {
        appareil: string;
        nombre: number;
        disposition: {
            batteriesParString: number;
            modulesEnParallele: number;
        };
    };
}

// RESULTATS MODULES PV

export interface ResultatModulesPV {
    appareil: string;
    configuration: "haute_tension" | "basse_tension";
    tensionParcPV?: number;         // Pour systèmes batterie basse tension

    // Disposition
    panneauxParString: number;      // Ns
    stringsEnParallele: number;     // Np
    totalPanneaux: number;

    // Tensions (important pour vérifications)
    tensionStringSTC: number;       // Vmpp à 25°C
    tensionStringMin: number;       // Vmpp à Tmax (condition chaude)
    tensionStringMax: number;       // Vmpp à Tmin (condition froide)
    vocStringFroid: number;         // Voc à Tmin (CRITIQUE sécurité)

    // Puissances
    puissancePVInstallee: {
        min: number;                // Condition chaude (déclassée)
        max: number;                // Condition froide
    };

    // Métadonnées internes
    _temperaturesCellule: {
        tCellMin: number;
        tCellMax: number;
    };
    _tensionModuleCorrigee: {
        mppMin: number;
        mppMax: number;
        vocFroid: number;
    };
}

// CÂBLAGE ET PROTECTIONS

export type MateriauConducteur = "cuivre" | "aluminium";

export type MethodePose =
    | "conduit_encastre"      // B2 - Référence NFC 15-100
    | "conduit_surface"       // B1
    | "air_libre"             // E/F
    | "enterre"               // D
    | "gaine_technique";      // C

export type ConditionEnvironnement =
    | "standard"              // 30°C ambiant
    | "chaud"                 // 40°C ambiant
    | "tres_chaud"            // 50°C ambiant
    | "extreme"               // 60°C ambiant (désert)
    | "humide"                // Impact isolation
    | "corrosif";             // Impact matériau

export type TypeCableSolaire = "PV1-F" | "H1Z2Z2-K";

export interface CableDCDimensionnement {
    // Caractéristiques
    section: number;                    // mm² (normalisée IEC 60228)
    materiau: MateriauConducteur;
    typeCable: TypeCableSolaire;

    // Électriques
    courantAdmissible: number;          // A (corrigé conditions réelles)
    courantDimensionnement: number;     // A (Isc × 1.25)
    resistanceLineique: number;         // Ω/km

    // Chute tension
    chuteTensionV: number;              // V absolu
    chuteTensionPourcent: number;       // %
    chuteTensionMax: number;           // % (1% ou 3% selon câble)

    // Géométrie
    longueur: number;                   // m
    nombreConducteurs: number;          // 2 (aller-retour)

    // Conditions
    temperatureAmbiante: number;        // °C
    temperatureConducteur: number;     // °C (calculée)
    methodePose: MethodePose;

    // Correction appliquées
    facteursCorrection: {
        kT: number;                     // Température
        kG: number;                     // Groupement
        kP: number;                     // Pose
        kM: number;                     // Matériau (Al vs Cu)
        total: number;
    };
}

export interface ProtectionDC {
    type: "fusible" | "sectionneur" | "parafoudre" | "disjoncteur";
    calibre?: number;                   // A (pour fusible/disjoncteur)
    tensionAssignee: number;            // V
    pouvoirCoupure?: number;          // kA
    norme: string;
    emplacement: string;
    caracteristiques?: string;        // gPV, etc.
}



export interface DimensionnementAC {
    section: number;                    // mm²
    materiau: MateriauConducteur;
    courantEmploi: number;              // A (IB)
    courantAdmissible: number;          // A (IZ)
    protection: number;                 // A (In disjoncteur)
    chuteTension: number;               // %
    chuteTensionMax: number;            // %
    ddr: {
        type: "A" | "B" | "F" | "AC";
        sensibilite: number;            // mA
        norme: string;
    };
    methodePose: MethodePose;
    facteursCorrection: Record<string, number>;
}

export interface ResultatDimensionnementCablage {
    // Câbles DC
    cablesString: CableDCDimensionnement[];
    cablePrincipalDC: CableDCDimensionnement;

    // Protections DC
    protectionsString: ProtectionDC[];
    protectionOnduleurDC: ProtectionDC[];
    parafoudreDC: ProtectionDC;

    // Câble et protection AC
    cablageAC?: DimensionnementAC;
    parafoudreAC?: ProtectionDC;

    // Synthèse
    sectionsStandardUtilisees: number[]; // Liste des sections IEC 60228 utilisées
    verificationChuteTensionGlobale: boolean;
    avertissements: string[];
}

// REQUETE/RESPONSE API

export interface DimensionnementPVRequest {
    // Localisation et site
    localisation: Localisation;

    // Consommation
    equipements: Equipement[];
    facteurFoisonnementGlobal?: number; // Kf (défaut: 0.8)

    // Configuration système
    typeInstallation: TypeInstallationPourPertes;
    typeSysteme: TypeSystemePV;

    // Composants
    parametresPanneau: ParametresSTCPanneau;
    temperaturesAttendue: TemperaturesMinMax;
    contraintesOnduleur?: ParametresOnduleur;

    // Stockage (off-grid/hybride)
    autonomieBatterie?: number;         // jours
    technologieBatterie?: TechnologieBatterie;

    // Câblage
    cablage?: {
        materiau?: MateriauConducteur;  // Défaut: cuivre
        longueurString?: number;        // m (défaut: 15)
        longueurPrincipalDC?: number;   // m (défaut: 10)
        longueurAC?: number;            // m (défaut: 20)
        methodePoseDC?: MethodePose;    // Défaut: conduit_surface
        methodePoseAC?: MethodePose;    // Défaut: conduit_encastre
        conditionEnvironnement?: ConditionEnvironnement; // Défaut: chaud (40°C)
    };

    // Pompage (optionnel)
    pompageSolaire?: boolean;
    pompageCaracteristiques?: PompageSolaireCaracteristiques;

    // Options avancées
    irradianceMax?: number;             // W/m² (défaut: 1000)
    tensionSystemeBatterie?: number;    // V (12/24/48) pour off-grid
}

export interface DimensionnementPVResponse {
    // Synthèse
    resume: {
        energieJournaliere_Wh: number;
        puissanceCreteCharge_W: number;
        puissanceCretePV_Wc: number;
        ratioDCAC?: number;
        surfaceEstimee_m2: number;
        nombreStrings: number;
    };

    // Site
    site: {
        localisation: Localisation;
        angleOptimal: {
            hemisphère: string;
            orientation: string;
            angle: number;
        };
        PSH_moisDefavorable: number;    // kWh/m²/j
        performanceRatio: number;
        pertesTotales_pourcent: number;
    };

    // Composants
    modulesPV: ResultatModulesPV;
    onduleur: ResultatOnduleur | null;
    stockage: ResultatStockage | null;
    cablage: ResultatDimensionnementCablage;

    // Conformité
    conformite: {
        normesReference: string[];
        verificationVoc: boolean;       // Voc < VdcMax onduleur
        verificationMPPT: boolean;      // Vmpp dans plage MPPT
        verificationIsc: boolean;       // Isc < IdcMax onduleur
        verificationChuteTension: boolean;
        avertissements: string[];
        erreurs: string[];
    };

    // Métadonnées
    meta: {
        timestamp: string;
        versionCalculateur: string;
    };
}

export interface ResultatOnduleur {
    appareil: string;
    typeSysteme: TypeSystemePV;
    grandeursChamp: {
        tCellMin: number;
        tCellMax: number;
        vocChampFroid: number;          // V - CRITIQUE
        vmppChampChaud: number;         // V
        vmppNominal: number;            // V
        iscChamp: number;               // A
        puissanceChampsWc: number;      // W
    };
    dimensionnement: {
        puissanceACMin: number;
        puissanceACRecommandee: number;
        puissanceACMax: number;
        ratioDCAC: number;
        evaluationRatio: "sous-dimensionne" | "optimal" | "acceptable" | "eleve";
    };
    verification: {
        compatible: boolean;
        details: {
            vocSousLimite: boolean;
            vmppAuDessusMinimum: boolean;
            vmppDansPlageMPPT: boolean;
            iscSousLimite: boolean;
            puissanceDCOk: boolean;
            chargeACOk: boolean;
            surchargeOk: boolean | null;
        };
    } | null;
    avertissements: string[];
    erreurs: string[];
}