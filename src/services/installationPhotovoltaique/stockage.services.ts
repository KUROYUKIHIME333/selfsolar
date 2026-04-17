import type { TechnologieBatterie } from "../../types/installationPhotovoltaique.types.js"

export class StockageService {
    capaciteStockage(technologie: TechnologieBatterie = "Plomb-acide", consommationJournaliere: number, autonomie: number, tensionSysteme: number) {
        let profondeur_decharge: number = 0.5;
        let min_cycles_DoD_Max: number = 300;
        let max_cycles_DoD_Max: number = 600;
        let temperatue_min: number = -20;
        let temperatue_max: number = 50;

        if (technologie === "LiFePO4") {
            profondeur_decharge = 0.8;
            min_cycles_DoD_Max = 2000;
            max_cycles_DoD_Max = 6000;
            temperatue_min = 0;
            temperatue_max = 55;
        };

        if (technologie === "Lithium NMC/NCA") {
            profondeur_decharge = 0.8;
            min_cycles_DoD_Max = 500;
            max_cycles_DoD_Max = 2000;
            temperatue_min = 0;
            temperatue_max = 45;
        };

        if (technologie === "NiCd") {
            profondeur_decharge = 0.6;
            min_cycles_DoD_Max = 1000;
            max_cycles_DoD_Max = 3000;
            temperatue_min = -20;
            temperatue_max = 45;
        };

        const capacite_utile = consommationJournaliere * autonomie;

        const capacite_nominale_Wh = capacite_utile / profondeur_decharge; // en Wh

        const capacite_nominale_Ah = capacite_nominale_Wh / tensionSysteme; // en Ah

        return {
            typeBatterie: technologie,
            DoDMax: profondeur_decharge,
            cyclesDoDMax: `${min_cycles_DoD_Max} - ${max_cycles_DoD_Max} cycles`,
            plageTemperatureFonctionnement: `${temperatue_min}°C à ${temperatue_min}°C`,
            capaciteWh: capacite_nominale_Wh,
            capaciteAh: capacite_nominale_Ah
        }
    };

    modulesBatteries(tensionSystem: number, tensionBatterie: number, capaciteBatterie: number, capaciteTotal: number) {
        const batteries_par_string = Math.round(tensionSystem / tensionBatterie);

        const strings_en_parallele = Math.ceil(capaciteTotal / capaciteBatterie);
    };

    regulateurBMS(puissancePVCrete: number, tensionBatteries: number, puissanceChargeMax: number, rendementOnduleur: number) {
        // I_charge_max [A] = P_PV_crête [W] / U_batterie [V]
        // I_décharge_max [A] = P_charge_max [W] / (U_batterie × η_onduleur)
        // Le BMS (Battery Management System) doit surveiller : tension cellule, courant, température, SoC (State of Charge), et assurer les protections (surtension, sous-tension, surcourant, court-circuit, inversion de polarité).
        // NF/IEC : IEC 62619 — Sécurité des systèmes de stockage Li-ion stationnaires
        const courant_charge_max = puissancePVCrete / tensionBatteries;
        const courant_decharge_max = puissanceChargeMax / (tensionBatteries * rendementOnduleur);

        return {
            appareil: "Battery Management System",
            IChargeMax: courant_charge_max,
            IDechargeMax: courant_decharge_max,
        };
    };

    
};

export const stockageService = new StockageService();