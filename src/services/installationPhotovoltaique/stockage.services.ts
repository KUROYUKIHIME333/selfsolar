import type {
    TechnologieBatterie,
    ResultatStockage
} from "../../types/installationPhotovoltaique.types.js";

// Service de dimensionnement du stockage électrochimique
// Conforme IEC 62619 (Li-ion), IEC 60896 (plomb), p.6 guide

export class StockageService {

    /**
     * Calcule la capacité de stockage requise
     * Formules :
     * - C_utile [Wh] = E_charge [Wh/j] × N_aut
     * - C_nominale [Wh] = C_utile / DoD_max
     * - C_Ah [Ah] = C_nominale [Wh] / U_batt [V]
     * 
     * Dé-rating température plomb: -1%/°C au-delà de 25°C (p.6 guide)
     * 
     * @param technologie Technologie batterie
     * @param consommationJournaliere Wh/jour
     * @param autonomie Jours d'autonomie souhaités
     * @param tensionSysteme Tension système batterie (V)
     * @param temperatureAmbiante Température ambiante max (°C, optionnel)
     * @returns Capacité nominale et utile avec métadonnées
     */
    capaciteStockage(
        technologie: TechnologieBatterie = "LiFePO4",
        consommationJournaliere: number,
        autonomie: number,
        tensionSysteme: number,
        temperatureAmbiante?: number
    ): ResultatStockage {

        // Paramètres par technologie (p.6 guide)
        let profondeurDecharge: number;
        let cyclesMin: number;
        let cyclesMax: number;
        let tempMin: number;
        let tempMax: number;

        switch (technologie) {
            case "Plomb-acide":
            case "AGM/Gel":
                profondeurDecharge = 0.50;      // 50% max pour longévité
                cyclesMin = 300;
                cyclesMax = 600;
                tempMin = -20;
                tempMax = 50;
                break;

            case "LiFePO4":
                profondeurDecharge = 0.85;      // 80-90% possible, 85% conservateur
                cyclesMin = 2000;
                cyclesMax = 6000;
                tempMin = 0;
                tempMax = 55;
                break;

            case "Lithium NMC/NCA":
                profondeurDecharge = 0.80;      // 80% pour sécurité
                cyclesMin = 500;
                cyclesMax = 2000;
                tempMin = 0;
                tempMax = 45;                   // Plus sensible chaleur que LFP
                break;

            case "NiCd":
                profondeurDecharge = 0.65;      // 60-70%
                cyclesMin = 1000;
                cyclesMax = 3000;
                tempMin = -20;
                tempMax = 45;
                break;

            default:
                throw new Error(`Technologie batterie non supportée: ${technologie}`);
        }

        // Énergie utile requise
        const capaciteUtile = consommationJournaliere * autonomie;

        // Capacité nominale brute (avant corrections)
        let capaciteNominaleWh = capaciteUtile / profondeurDecharge;

        let deratingApplique = false;

        // CORRECTION: Dé-rating température pour plomb-acide (p.6 guide)
        // "En RDC et milieu tropical... Dé-rating recommandé: −1%/°C au-delà de 25°C"
        if ((technologie === "Plomb-acide" || technologie === "AGM/Gel") && temperatureAmbiante) {
            if (temperatureAmbiante > 25) {
                const perteCapacite = (temperatureAmbiante - 25) * 0.01; // 1% par °C
                const facteurDerating = 1 + perteCapacite; // Augmenter capacité pour compenser
                capaciteNominaleWh = capaciteNominaleWh * facteurDerating;
                deratingApplique = true;
            }
        }

        // Conversion Ah
        const capaciteNominaleAh = capaciteNominaleWh / tensionSysteme;

        return {
            appareil: "Batteries",
            typeBatterie: technologie,
            DoDMax: profondeurDecharge,
            cyclesDoDMax: {
                min: cyclesMin,
                max: cyclesMax
            },
            plageTemperatureFonctionnement: {
                min: tempMin,
                max: tempMax  // ✅ CORRIGÉ: était tempMin avant
            },
            capacite: {
                utile_Wh: Math.round(capaciteUtile),
                nominale_Wh: Math.round(capaciteNominaleWh),
                nominale_Ah: Math.round(capaciteNominaleAh * 10) / 10
            },
            autonomieJours: autonomie,
            temperatureDeratingApplique: deratingApplique
        };
    }

    /**
     * Calcule la disposition des modules batterie (série/parallèle)
     * 
     * @param tensionSystem Tension système cible (V)
     * @param tensionBatterie Tension unitaire batterie (V, typ: 12V)
     * @param capaciteBatterie Capacité unitaire (Ah)
     * @param capaciteTotal Capacité totale requise (Ah)
     * @returns Disposition optimale
     */
    modulesBatteries(
        tensionSystem: number,
        tensionBatterie: number,
        capaciteBatterie: number,
        capaciteTotal: number
    ): {
        appareil: string;
        nombre: number;
        disposition: {
            batteriesParString: number;
            modulesEnParallele: number;
        };
    } {
        // Nombre de batteries en série pour tension système
        const batteriesParString = Math.round(tensionSystem / tensionBatterie);

        // Vérification cohérence
        if (Math.abs(batteriesParString * tensionBatterie - tensionSystem) > tensionBatterie * 0.1) {
            console.warn(`Tension système ${tensionSystem}V non multiple de ${tensionBatterie}V`);
        }

        // Nombre de strings en parallèle pour capacité
        const stringsEnParallele = Math.ceil(capaciteTotal / capaciteBatterie);

        return {
            appareil: "Batteries",
            nombre: batteriesParString * stringsEnParallele,
            disposition: {
                batteriesParString: batteriesParString,
                modulesEnParallele: stringsEnParallele
            }
        };
    }

    /**
     * Dimensionne le régulateur de charge / BMS
     * Formules (p.6 guide):
     * - I_charge_max = P_PV_crête / U_batterie
     * - I_décharge_max = P_charge_max / (U_batterie × η_onduleur)
     * 
     * Référence: IEC 62619 (sécurité Li-ion stationnaire)
     * 
     * @param puissancePVCrete Puissance crête PV (W)
     * @param tensionBatteries Tension batterie (V)
     * @param puissanceChargeMax Puissance max charge (W)
     * @param rendementOnduleur Rendement onduleur (0-1)
     * @returns Courants max charge/décharge
     */
    regulateurBMS(
        puissancePVCrete: number,
        tensionBatteries: number,
        puissanceChargeMax: number,
        rendementOnduleur: number
    ): {
        appareil: string;
        IChargeMax: number;      // A
        IDechargeMax: number;    // A
        IBMSRecommande: number;  // A (avec marge 25%)
    } {
        // Courant charge max (entrée PV)
        const courantChargeMax = puissancePVCrete / tensionBatteries;

        // Courant décharge max (sortie vers charge/onduleur)
        const courantDechargeMax = puissanceChargeMax / (tensionBatteries * rendementOnduleur);

        // BMS avec marge de 25% pour pics et vieillissement
        const iBMSRecommande = Math.max(courantChargeMax, courantDechargeMax) * 1.25;

        return {
            appareil: "Battery Management System",
            IChargeMax: Math.round(courantChargeMax * 100) / 100,
            IDechargeMax: Math.round(courantDechargeMax * 100) / 100,
            IBMSRecommande: Math.ceil(iBMSRecommande / 10) * 10 // Arrondi dizaine supérieure
        };
    }
}

export const stockageService = new StockageService();