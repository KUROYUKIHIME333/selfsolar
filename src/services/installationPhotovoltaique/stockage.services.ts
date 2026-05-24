import type {
  TechnologieBatterie,
  ResultatStockage,
} from "../../types/installationPhotovoltaique.types.js";

// Spécifications de la technologie conformes IEC 62619 (Li-ion), IEC 60896 (plomb) et p.6 du guide
interface CommunesTechnologie {
  readonly profondeurDecharge: number;
  readonly cyclesMin: number;
  readonly cyclesMax: number;
  readonly tempMin: number;
  readonly tempMax: number;
}

// Dictionnaire de configuration des technologies figé et validé via satisfies
const CONFIG_TECHNOLOGIES: Record<TechnologieBatterie, CommunesTechnologie> = {
  "Plomb-acide": {
    profondeurDecharge: 0.5,
    cyclesMin: 300,
    cyclesMax: 700,
    tempMin: -15,
    tempMax: 40,
  },
  "AGM/Gel": {
    profondeurDecharge: 0.5,
    cyclesMin: 300,
    cyclesMax: 700,
    tempMin: -15,
    tempMax: 40,
  },
  LiFePO4: {
    profondeurDecharge: 0.8,
    cyclesMin: 3000,
    cyclesMax: 6000,
    tempMin: 0,
    tempMax: 55,
  },
  "Lithium NMC/NCA": {
    profondeurDecharge: 0.8,
    cyclesMin: 500,
    cyclesMax: 2000,
    tempMin: 0,
    tempMax: 45,
  },
  NiCd: {
    profondeurDecharge: 0.8,
    cyclesMin: 1500,
    cyclesMax: 3500,
    tempMin: -20,
    tempMax: 50,
  },
};
export class StockageService {
  /**
   * Valide la cohérence physique des paramètres d'entrée
   * Évite les divisions par zéro, les valeurs infinies ou absurdes au runtime
   */
  private validationParametres(
    nomFonction: string,
    parametres: Record<string, unknown>
  ): void {
    for (const [cle, val] of Object.entries(parametres)) {
      // Évite le faux-positif si la température ambiante optionnelle n'est pas fournie
      if (
        cle === "temperatureAmbiante" &&
        (val === undefined || val === null)
      ) {
        continue;
      }

      if (val === undefined || val === null) {
        throw new Error(
          `[StockageService.${nomFonction}] Le paramètre '${cle}' est manquant.`
        );
      }

      if (typeof val === "number") {
        if (isNaN(val) || !isFinite(val)) {
          throw new Error(
            `[StockageService.${nomFonction}] Le paramètre '${cle}' n'est pas un nombre valide.`
          );
        }

        // Règles seulement pour les valeurs qui doivent être strictement positives
        if (
          [
            "consommationJournaliere",
            "autonomie",
            "tensionSysteme",
            "tensionBatterie",
            "capaciteBatterie",
            "capaciteTotal",
            "puissancePVCrete",
            "tensionBatteries",
            "puissanceChargeMax",
          ].includes(cle) &&
          val <= 0
        ) {
          throw new Error(
            `[StockageService.${nomFonction}] Le paramètre '${cle}' doit être strictement supérieur à 0.`
          );
        }

        // Règle d'or pour le rendement de l'onduleur
        if (cle === "rendementOnduleur" && (val <= 0 || val > 1)) {
          throw new Error(
            `[StockageService.${nomFonction}] Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus).`
          );
        }
      }
    }
  }

  /**
   * Calcule la capacité de stockage requise
   * Formules :
   * - C_utile [Wh] = E_charge [Wh/j] × N_aut
   * - C_nominale [Wh] = C_utile / DoD_max
   * - C_Ah [Ah] = C_nominale [Wh] / U_batt [V]
   *
   * Dé-rating température plomb: -1%/°C au-delà de 25°C (p.6 guide)
   */
  capaciteStockage(
    technologie: TechnologieBatterie = "LiFePO4",
    consommationJournaliere: number,
    autonomie: number,
    tensionSysteme: number,
    temperatureAmbiante?: number
  ): ResultatStockage {
    this.validationParametres("capaciteStockage", {
      consommationJournaliere,
      autonomie,
      tensionSysteme,
      temperatureAmbiante,
    });

    const config = CONFIG_TECHNOLOGIES[technologie];
    if (!config) {
      throw new Error(`Technologie batterie non supportée: ${technologie}`);
    }

    const { profondeurDecharge, cyclesMin, cyclesMax, tempMin, tempMax } =
      config;

    // Énergie utile requise
    const capaciteUtile = consommationJournaliere * autonomie;

    // Capacité nominale brute (avant corrections)
    let capaciteNominaleWh = capaciteUtile / profondeurDecharge;
    let deratingApplique = false;

    // CORRECTION: Dé-rating température pour le plomb-acide (p.6 guide)
    // Utilisation d'une vérification stricte contre undefined pour autoriser la valeur 0°C
    if (
      (technologie === "Plomb-acide" || technologie === "AGM/Gel") &&
      temperatureAmbiante !== undefined &&
      temperatureAmbiante > 25
    ) {
      const tClamped = Math.min(temperatureAmbiante, 50);
      let facteurDerating = 1;

      if (tClamped <= 40) {
        facteurDerating += (tClamped - 25) * 0.01; // +1% par °C
      } else {
        const zoneStandard = (40 - 25) * 0.01; // 15%
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
    this.validationParametres("modulesBatteries", {
      tensionSysteme: tensionSystem,
      tensionBatterie,
      capaciteBatterie,
      capaciteTotal,
    });

    const batteriesParString = Math.round(tensionSystem / tensionBatterie);

    if (
      Math.abs(batteriesParString * tensionBatterie - tensionSystem) >
      tensionBatterie * 0.1
    ) {
      console.warn(
        `Tension système ${tensionSystem}V non multiple de ${tensionBatterie}V`
      );
    }

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
   */
  regulateurBMS(
    puissancePVCrete: number,
    tensionBatteries: number,
    puissanceChargeMax: number,
    rendementOnduleur: number
  ): {
    appareil: string;
    IChargeMax: number;
    IDechargeMax: number;
    IBMSRecommande: number;
  } {
    this.validationParametres("regulateurBMS", {
      puissancePVCrete,
      tensionBatteries,
      puissanceChargeMax,
      rendementOnduleur,
    });

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
      IBMSRecommande: Math.ceil(iBMSRecommande / 10) * 10, // Arrondi à la dizaine supérieure
    };
  }
}

export const stockageService = new StockageService();
