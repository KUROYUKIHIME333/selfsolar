export type Equipement = {
    nom: string | null | undefined,
    P: number, // en W
    h: number, // en h/j
    ks: number,
};

export type NasaPowerResponse = {

};

export type Localisation = {
    lat: number,
    long: number
};

export type TypeInstallationPourPertes = "HAUTE_QUALITE" | "STANDARD" | "POUSSIEREUX" | "FAIBLE_MAINTENANCE" | "ANCIEN" | "CABLE_LONG";

// E_hydraulique [Wh/j] = ρ × g × Q × H_man / (3600 × η_pompe)
// Avec P_PV_pompe [Wc] = E_hydraulique / (PSH × η_onduleur_MPPT × PR_réduit)
export type PompageSolaireCaracteristiques = {
    batteries: boolean,
    masseVolumique: number,
    accelerationPesanteur: number,
    debit: number,
    hauteurMano: number,
    rendementPompe: number,

    // ρ = masse volumique eau = 1000 kg/m³
    // g = 9,81 m/s²
    // Q = débit en m³/j
    // H_man = hauteur manométrique totale en m
    // η_pompe = rendement pompe (0,4–0,7)
};

export type ParametresSTCPanneau = {
    puissanceCreteModule: number, // (Wp) Puissance en point MPP en STC
    tensionCircuitOuvert: number, // Voc; Tension à courant nul — détermine tenue des équipements
    courantCourtCircuit: number, // Isc; Courant max — dimensionne câbles et protections
    tensionMPP: number, // Vmpp; Tension au point de puissance max
    courantMPP: number, // Impp; Courant au point de puissance max
    coeffTempTension: number, // β (Voc); Typique : −0,30 à −0,45 %/°C
    coeffTempPuissance: number, // γ (Pmax); Typique : −0,35 à −0,45 %/°C
};

export type TemperaturesMinMax = {
    temperatureMin: number,
    temperatureMax: number
}

