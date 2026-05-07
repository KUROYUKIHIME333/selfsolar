import type {
  TechnologieBatterie,
  ResultatStockage,
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
        // Le plomb est extrêmement sensible à la chaleur et à la profondeur de décharge.
        profondeurDecharge = 0.5; // 50% max pour éviter la sulfatation précoce
        cyclesMin = 300;
        cyclesMax = 700; // 700 pour du Gel tubulaire (OPzV) de haute qualité
        tempMin = -15;
        tempMax = 40; // CRITIQUE : Au-delà de 40°C, la chimie du plomb se dégrade de façon exponentielle.
        break;

      case "LiFePO4":
        profondeurDecharge = 0.8; // 80% est le standard industriel pour garantir +3000 cycles
        cyclesMin = 3000; // Les cellules Grade A commencent à 3000-3500 cycles
        cyclesMax = 6000;
        tempMin = 0; // DANGER : Ne jamais charger du lithium sous 0°C (risque de placage de lithium)
        tempMax = 55;
        break;

      case "Lithium NMC/NCA":
        // Plus dense mais moins durable et plus sensible que le LFP.
        profondeurDecharge = 0.8;
        cyclesMin = 500;
        cyclesMax = 2000;
        tempMin = 0;
        tempMax = 45; // Sensible à l'emballement thermique au-dessus de 45-50°C
        break;

      case "NiCd":
        // Best now pour l'industrie et les conditions extrêmes.
        profondeurDecharge = 0.8; // Le NiCd supporte des décharges profondes sans dommage
        cyclesMin = 1500;
        cyclesMax = 3500;
        tempMin = -20;
        tempMax = 50; // Très tolérant aux climats tropicaux (Kinshasa, etc.)
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
    // En RDC et milieu tropical... Dé-rating recommandé: −1%/°C au-delà de 25°C
    if (
      (technologie === "Plomb-acide" || technologie === "AGM/Gel") &&
      temperatureAmbiante &&
      temperatureAmbiante > 25
    ) {
      const tClamped = Math.min(temperatureAmbiante, 50);
      let facteurDerating = 1;

      if (tClamped <= 40) {
        // Zone de dégradation linéaire standard (25°C à 40°C)
        const deltaTemp = tClamped - 25;
        facteurDerating += deltaTemp * 0.01; // +1% par °C
      } else {
        // Zone critique (> 40°C) : on cumule la zone standard + la zone critique
        const zoneStandard = (40 - 25) * 0.01; // 0.15 (soit 15%)
        const zoneCritique = (tClamped - 40) * 0.02; // +2% par °C au-dessus de 40

        facteurDerating += zoneStandard + zoneCritique;

        console.warn(
          `Température de ${tClamped}°C détectée. Application d'un surdimensionnement critique.`
        );
      }

      capaciteNominaleWh = capaciteNominaleWh * facteurDerating;
      deratingApplique = true;
    }

    // Conversion Ah
    const capaciteNominaleAh = capaciteNominaleWh / tensionSysteme;

    return {
      appareil: "Batteries",
      typeBatterie: technologie,
      DoDMax: profondeurDecharge,
      cyclesDoDMax: {
        min: cyclesMin,
        max: cyclesMax,
      },
      plageTemperatureFonctionnement: {
        min: tempMin,
        max: tempMax,
      },
      capacite: {
        utile_Wh: Math.round(capaciteUtile),
        nominale_Wh: Math.round(capaciteNominaleWh),
        nominale_Ah: Math.round(capaciteNominaleAh * 10) / 10,
      },
      autonomieJours: autonomie,
      temperatureDeratingApplique: deratingApplique,
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
    if (
      Math.abs(batteriesParString * tensionBatterie - tensionSystem) >
      tensionBatterie * 0.1
    ) {
      console.warn(
        `Tension système ${tensionSystem}V non multiple de ${tensionBatterie}V`
      );
    }

    // Nombre de strings en parallèle pour capacité
    const stringsEnParallele = Math.ceil(capaciteTotal / capaciteBatterie);

    return {
      appareil: "Batteries",
      nombre: batteriesParString * stringsEnParallele,
      disposition: {
        batteriesParString: batteriesParString,
        modulesEnParallele: stringsEnParallele,
      },
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
    IChargeMax: number; // A
    IDechargeMax: number; // A
    IBMSRecommande: number; // A (avec marge 25%)
  } {
    // Courant charge max (entrée PV)
    const courantChargeMax = puissancePVCrete / tensionBatteries;

    // Courant décharge max (sortie vers charge/onduleur)
    const courantDechargeMax =
      puissanceChargeMax / (tensionBatteries * rendementOnduleur);

    // BMS avec marge de 25% pour pics et vieillissement
    const iBMSRecommande =
      Math.max(courantChargeMax, courantDechargeMax) * 1.25;

    return {
      appareil: "Battery Management System",
      IChargeMax: Math.round(courantChargeMax * 100) / 100,
      IDechargeMax: Math.round(courantDechargeMax * 100) / 100,
      IBMSRecommande: Math.ceil(iBMSRecommande / 10) * 10, // Arrondi dizaine supérieure
    };
  }
}

export const stockageService = new StockageService();
