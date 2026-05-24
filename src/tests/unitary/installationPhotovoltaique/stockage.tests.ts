import { describe, it, expect, vi, afterEach } from "vitest";
import { StockageService } from "../../../services/installationPhotovoltaique/stockage.services.js";
import type { TechnologieBatterie } from "../../../types/installationPhotovoltaique.types.js";

describe("StockageService", () => {
  const service = new StockageService();

  // Nettoie proprement tous les espions après chaque test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // TESTS POUR capaciteStockage
  // ============================================================
  describe("capaciteStockage", () => {
    it("doit calculer la capacité pour LiFePO4 avec valeurs standard", () => {
      const result = service.capaciteStockage(
        "LiFePO4",
        6000, // consommation journalière Wh
        2, // autonomie jours
        48 // tension système V
      );

      expect(result.appareil).toBe("Batteries");
      expect(result.typeBatterie).toBe("LiFePO4");
      expect(result.DoDMax).toBe(0.8);
      expect(result.autonomieJours).toBe(2);
      expect(result.temperatureDeratingApplique).toBe(false);

      // C_utile = 6000 * 2 = 12000 Wh
      expect(result.capacite.utile_Wh).toBe(12000);
      // C_nominale = 12000 / 0.8 = 15000 Wh
      expect(result.capacite.nominale_Wh).toBe(15000);
      // C_Ah = 15000 / 48 = 312.5 Ah
      expect(result.capacite.nominale_Ah).toBe(312.5);

      expect(result.cyclesDoDMax.min).toBe(3000);
      expect(result.cyclesDoDMax.max).toBe(6000);
      expect(result.plageTemperatureFonctionnement.min).toBe(0);
      expect(result.plageTemperatureFonctionnement.max).toBe(55);
    });

    it("doit utiliser LiFePO4 par défaut si technologie non spécifiée", () => {
      const result = service.capaciteStockage(undefined as any, 5000, 1, 24);
      expect(result.typeBatterie).toBe("LiFePO4");
    });

    it("doit calculer correctement pour Plomb-acide", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 3, 24);

      expect(result.typeBatterie).toBe("Plomb-acide");
      expect(result.DoDMax).toBe(0.5);
      // C_utile = 4000 * 3 = 12000 Wh
      expect(result.capacite.utile_Wh).toBe(12000);
      // C_nominale = 12000 / 0.5 = 24000 Wh
      expect(result.capacite.nominale_Wh).toBe(24000);
      // C_Ah = 24000 / 24 = 1000 Ah
      expect(result.capacite.nominale_Ah).toBe(1000);

      expect(result.cyclesDoDMax.min).toBe(300);
      expect(result.cyclesDoDMax.max).toBe(700);
      expect(result.plageTemperatureFonctionnement.min).toBe(-15);
      expect(result.plageTemperatureFonctionnement.max).toBe(40);
    });

    it("doit calculer correctement pour AGM/Gel", () => {
      const result = service.capaciteStockage("AGM/Gel", 3000, 1, 12);

      expect(result.typeBatterie).toBe("AGM/Gel");
      expect(result.DoDMax).toBe(0.5);
      expect(result.capacite.utile_Wh).toBe(3000);
      expect(result.capacite.nominale_Wh).toBe(6000);
      expect(result.capacite.nominale_Ah).toBe(500);
    });

    it("doit calculer correctement pour Lithium NMC/NCA", () => {
      const result = service.capaciteStockage("Lithium NMC/NCA", 8000, 2, 48);

      expect(result.typeBatterie).toBe("Lithium NMC/NCA");
      expect(result.DoDMax).toBe(0.8);
      expect(result.capacite.utile_Wh).toBe(16000);
      expect(result.capacite.nominale_Wh).toBe(20000);
      expect(result.capacite.nominale_Ah).toBeCloseTo(416.7, 1);

      expect(result.cyclesDoDMax.min).toBe(500);
      expect(result.cyclesDoDMax.max).toBe(2000);
      expect(result.plageTemperatureFonctionnement.min).toBe(0);
      expect(result.plageTemperatureFonctionnement.max).toBe(45);
    });

    it("doit calculer correctement pour NiCd", () => {
      const result = service.capaciteStockage("NiCd", 2000, 1, 24);

      expect(result.typeBatterie).toBe("NiCd");
      expect(result.DoDMax).toBe(0.8);
      expect(result.capacite.utile_Wh).toBe(2000);
      expect(result.capacite.nominale_Wh).toBe(2500);
      expect(result.capacite.nominale_Ah).toBeCloseTo(104.2, 1);

      expect(result.cyclesDoDMax.min).toBe(1500);
      expect(result.cyclesDoDMax.max).toBe(3500);
      expect(result.plageTemperatureFonctionnement.min).toBe(-20);
      expect(result.plageTemperatureFonctionnement.max).toBe(50);
    });

    it("doit appliquer le dé-rating température pour Plomb-acide au-delà de 25°C", () => {
      const result = service.capaciteStockage(
        "Plomb-acide",
        4000,
        2,
        24,
        35 // température ambiante 35°C
      );

      expect(result.temperatureDeratingApplique).toBe(true);
      // Facteur derating = 1 + (35-25)*0.01 = 1.10
      // C_nominale brute = 4000*2/0.5 = 16000
      // C_nominale corrigée = 16000 * 1.10 = 17600
      expect(result.capacite.nominale_Wh).toBe(17600);
    });

    it("doit appliquer le dé-rating critique pour Plomb-acide au-delà de 40°C", () => {
      const result = service.capaciteStockage(
        "Plomb-acide",
        4000,
        2,
        24,
        45 // température ambiante 45°C
      );

      expect(result.temperatureDeratingApplique).toBe(true);
      // Facteur = 1 + 15*0.01 + 5*0.02 = 1 + 0.15 + 0.10 = 1.25
      // C_nominale = 16000 * 1.25 = 20000
      expect(result.capacite.nominale_Wh).toBe(20000);
    });

    it("doit clamp la température à 50°C pour le dé-rating", () => {
      const result = service.capaciteStockage(
        "Plomb-acide",
        4000,
        2,
        24,
        60 // température > 50°C
      );

      expect(result.temperatureDeratingApplique).toBe(true);
      // Facteur = 1 + 15*0.01 + 10*0.02 = 1 + 0.15 + 0.20 = 1.35
      expect(result.capacite.nominale_Wh).toBe(21600);
    });

    it("ne doit pas appliquer de dé-rating si température ≤ 25°C", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 2, 24, 20);

      expect(result.temperatureDeratingApplique).toBe(false);
      expect(result.capacite.nominale_Wh).toBe(16000);
    });

    it("ne doit pas appliquer de dé-rating pour LiFePO4 même à haute température", () => {
      const result = service.capaciteStockage("LiFePO4", 6000, 2, 48, 45);

      expect(result.temperatureDeratingApplique).toBe(false);
      expect(result.capacite.nominale_Wh).toBe(15000);
    });

    it("doit rejeter une consommation journalière nulle", () => {
      expect(() => service.capaciteStockage("LiFePO4", 0, 2, 48)).toThrow(
        "consommationJournaliere"
      );
    });

    it("doit rejeter une consommation journalière négative", () => {
      expect(() => service.capaciteStockage("LiFePO4", -100, 2, 48)).toThrow(
        "consommationJournaliere"
      );
    });

    it("doit rejeter une autonomie nulle", () => {
      expect(() => service.capaciteStockage("LiFePO4", 5000, 0, 48)).toThrow(
        "autonomie"
      );
    });

    it("doit rejeter une tension système nulle", () => {
      expect(() => service.capaciteStockage("LiFePO4", 5000, 2, 0)).toThrow(
        "tensionSysteme"
      );
    });

    it("doit rejeter une technologie non supportée", () => {
      expect(() =>
        service.capaciteStockage("Inconnue" as TechnologieBatterie, 5000, 2, 48)
      ).toThrow("non supportée");
    });

    it("doit gérer des valeurs décimales avec précision", () => {
      const result = service.capaciteStockage("LiFePO4", 1234.5, 1.5, 48);

      expect(result.capacite.utile_Wh).toBe(1852); // round(1234.5 * 1.5)
      expect(result.capacite.nominale_Wh).toBe(2315); // round(1852 / 0.8)
      expect(result.capacite.nominale_Ah).toBeCloseTo(48.2, 1); // round(2315/48 * 10)/10
    });

    it("doit gérer un projet industriel de grande consommation", () => {
      const result = service.capaciteStockage(
        "LiFePO4",
        500000, // 500 kWh/j
        3,
        480
      );

      expect(result.capacite.utile_Wh).toBe(1500000);
      expect(result.capacite.nominale_Wh).toBe(1875000);
      expect(result.capacite.nominale_Ah).toBeCloseTo(3906.3, 1);
    });
  });

  // ============================================================
  // TESTS POUR modulesBatteries
  // ============================================================
  describe("modulesBatteries", () => {
    it("doit calculer la disposition pour un système 48V avec batteries 12V", () => {
      const result = service.modulesBatteries(48, 12, 100, 200);

      expect(result.appareil).toBe("Batteries");
      expect(result.disposition.batteriesParString).toBe(4); // 48/12 = 4
      expect(result.disposition.modulesEnParallele).toBe(2); // ceil(200/100)
      expect(result.nombre).toBe(8); // 4 * 2
    });

    it("doit calculer la disposition pour un système 24V avec batteries 6V", () => {
      const result = service.modulesBatteries(24, 6, 200, 400);

      expect(result.disposition.batteriesParString).toBe(4); // 24/6 = 4
      expect(result.disposition.modulesEnParallele).toBe(2); // ceil(400/200)
      expect(result.nombre).toBe(8);
    });

    it("doit calculer avec un seul string si capacité suffisante", () => {
      const result = service.modulesBatteries(48, 12, 300, 200);

      expect(result.disposition.batteriesParString).toBe(4);
      expect(result.disposition.modulesEnParallele).toBe(1); // ceil(200/300) = 1
      expect(result.nombre).toBe(4);
    });

    it("doit arrondir batteriesParString à l'entier le plus proche", () => {
      const result = service.modulesBatteries(48, 12.8, 100, 200);

      expect(result.disposition.batteriesParString).toBe(4); // round(48/12.8) = round(3.75) = 4
    });

    it("doit émettre un warning si tension non multiple", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      service.modulesBatteries(50, 12, 100, 200);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0]?.[0]).toContain("non multiple");
      // Plus besoin du mockRestore() ici, vi.restoreAllMocks() dans afterEach s'en occupe
    });

    it("doit rejeter une tension système nulle", () => {
      expect(() => service.modulesBatteries(0, 12, 100, 200)).toThrow(
        "tensionSysteme"
      );
    });

    it("doit rejeter une tension batterie nulle", () => {
      expect(() => service.modulesBatteries(48, 0, 100, 200)).toThrow(
        "tensionBatterie"
      );
    });

    it("doit rejeter une capacité batterie nulle", () => {
      expect(() => service.modulesBatteries(48, 12, 0, 200)).toThrow(
        "capaciteBatterie"
      );
    });

    it("doit rejeter une capacité totale nulle", () => {
      expect(() => service.modulesBatteries(48, 12, 100, 0)).toThrow(
        "capaciteTotal"
      );
    });

    it("doit gérer des valeurs décimales", () => {
      const result = service.modulesBatteries(48, 3.2, 280, 560);

      expect(result.disposition.batteriesParString).toBe(15); // round(48/3.2) = 15
      expect(result.disposition.modulesEnParallele).toBe(2); // ceil(560/280)
      expect(result.nombre).toBe(30);
    });
  });

  // ============================================================
  // TESTS POUR regulateurBMS
  // ============================================================
  describe("regulateurBMS", () => {
    it("doit dimensionner le BMS pour un petit système", () => {
      const result = service.regulateurBMS(
        3000, // puissance PV crête W
        48, // tension batteries V
        2500, // puissance charge max W
        0.98 // rendement onduleur
      );

      expect(result.appareil).toBe("Battery Management System");

      // IChargeMax = 3000 / 48 = 62.5 A
      expect(result.IChargeMax).toBe(62.5);

      // IDechargeMax = 2500 / (48 * 0.98) = 2500 / 47.04 = 53.15 A
      expect(result.IDechargeMax).toBeCloseTo(53.15, 1);

      // IBMSRecommande = max(62.5, 53.15) * 1.25 = 78.125
      // Arrondi à la dizaine supérieure = 80
      expect(result.IBMSRecommande).toBe(80);
    });

    it("doit dimensionner le BMS quand courant charge > courant décharge", () => {
      const result = service.regulateurBMS(5000, 24, 1000, 0.95);

      // IChargeMax = 5000 / 24 = 208.33 A
      expect(result.IChargeMax).toBeCloseTo(208.33, 1);

      // IDechargeMax = 1000 / (24 * 0.95) = 1000 / 22.8 = 43.86 A
      expect(result.IDechargeMax).toBeCloseTo(43.86, 1);

      // IBMS = 208.33 * 1.25 = 260.41 -> arrondi dizaine = 270
      expect(result.IBMSRecommande).toBe(270);
    });

    it("doit dimensionner le BMS quand courant décharge > courant charge", () => {
      const result = service.regulateurBMS(2000, 48, 5000, 0.98);

      // IChargeMax = 2000 / 48 = 41.67 A
      expect(result.IChargeMax).toBeCloseTo(41.67, 1);

      // IDechargeMax = 5000 / (48 * 0.98) = 5000 / 47.04 = 106.30 A
      expect(result.IDechargeMax).toBeCloseTo(106.3, 1);

      // IBMS = 106.30 * 1.25 = 132.87 -> ceil(13.287)*10 = 14*10 = 140
      expect(result.IBMSRecommande).toBe(140);
    });

    it("doit rejeter une puissance PV nulle", () => {
      expect(() => service.regulateurBMS(0, 48, 2000, 0.98)).toThrow(
        "puissancePVCrete"
      );
    });

    it("doit rejeter une tension batterie nulle", () => {
      expect(() => service.regulateurBMS(3000, 0, 2000, 0.98)).toThrow(
        "tensionBatteries"
      );
    });

    it("doit rejeter une puissance charge max nulle", () => {
      expect(() => service.regulateurBMS(3000, 48, 0, 0.98)).toThrow(
        "puissanceChargeMax"
      );
    });

    it("doit lancer une erreur si le rendement de l'onduleur est nul", () => {
      expect(() => service.regulateurBMS(3000, 48, 2000, 0)).toThrow(
        "Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus)."
      );
    });

    it("doit lancer une erreur si le rendement de l'onduleur est supérieur à 1", () => {
      expect(() => service.regulateurBMS(3000, 48, 2000, 1.1)).toThrow(
        "Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus)."
      );
    });

    it("doit lancer une erreur si le rendement de l'onduleur est négatif", () => {
      expect(() => service.regulateurBMS(3000, 48, 2000, -0.5)).toThrow(
        "Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus)."
      );
    });

    it("doit gérer un rendement onduleur de 1 (100%)", () => {
      const result = service.regulateurBMS(
        1000, // puissance PV crête W
        24, // tension batteries V
        1000, // puissance charge max W
        1.0 // rendement
      );

      // Courant Charge = 1000 / 24 = 41.67 A
      expect(result.IChargeMax).toBeCloseTo(41.67, 1);
      // Courant Décharge = 1000 / (24 * 1) = 41.67 A
      expect(result.IDechargeMax).toBeCloseTo(41.67, 1);

      // Max(41.67, 41.67) * 1.25 = 52.08 A
      // Arrondi à la dizaine supérieure -> 60
      expect(result.IBMSRecommande).toBe(60);
    });

    it("doit gérer un projet industriel de grande puissance", () => {
      const result = service.regulateurBMS(
        50000, // 50 kWc
        480, // 480V
        40000, // 40 kW charge
        0.98
      );

      expect(result.IChargeMax).toBeCloseTo(104.17, 1);
      expect(result.IDechargeMax).toBeCloseTo(85.03, 1);
      expect(result.IBMSRecommande).toBe(140); // 104.17*1.25=130.2 -> 140
    });
  });

  // ============================================================
  // TESTS DE ROBUSTESSE
  // ============================================================
  describe("Robustesse technique", () => {
    it("ne doit pas modifier les objets d'entrée (immuabilité)", () => {
      const params = {
        techno: "LiFePO4" as TechnologieBatterie,
        conso: 6000,
        auto: 2,
        tension: 48,
      };
      const backup = JSON.stringify(params);

      service.capaciteStockage(
        params.techno,
        params.conso,
        params.auto,
        params.tension
      );

      expect(JSON.stringify(params)).toBe(backup);
    });

    it("doit gérer des paramètres avec décimales", () => {
      const result = service.capaciteStockage("LiFePO4", 1234.56, 2.5, 51.2);

      expect(result.capacite.utile_Wh).toBe(3086); // round(1234.56 * 2.5)
      expect(result.capacite.nominale_Ah).toBeGreaterThan(0);
    });

    it("doit rejeter NaN dans les paramètres", () => {
      expect(() => service.capaciteStockage("LiFePO4", NaN, 2, 48)).toThrow(
        "consommationJournaliere"
      );
    });

    it("doit rejeter Infinity dans les paramètres", () => {
      expect(() =>
        service.capaciteStockage("LiFePO4", Infinity, 2, 48)
      ).toThrow("consommationJournaliere");
    });

    it("doit rejeter des valeurs manquantes (undefined)", () => {
      expect(() =>
        service.capaciteStockage("LiFePO4", undefined as any, 2, 48)
      ).toThrow("consommationJournaliere");
    });
  });

  // ============================================================
  // TESTS D'INTÉGRATION
  // ============================================================
  describe("Tests d'intégration - Flux complet", () => {
    it("doit dimensionner un système de stockage complet 48V LiFePO4", () => {
      // 1. Capacité requise
      const capacite = service.capaciteStockage(
        "LiFePO4",
        6000, // 6 kWh/j
        2, // 2 jours autonomie
        48
      );
      expect(capacite.capacite.nominale_Ah).toBe(312.5);

      // 2. Disposition avec batteries 3.2V 100Ah
      const modules = service.modulesBatteries(
        48,
        3.2,
        100,
        capacite.capacite.nominale_Ah
      );
      expect(modules.disposition.batteriesParString).toBe(15); // 48/3.2
      expect(modules.disposition.modulesEnParallele).toBe(4); // ceil(312.5/100)
      expect(modules.nombre).toBe(60);

      // 3. BMS pour 5 kWc PV et 4 kW charge
      const bms = service.regulateurBMS(5000, 48, 4000, 0.98);
      expect(bms.IChargeMax).toBeCloseTo(104.17, 1);
      expect(bms.IBMSRecommande).toBe(140);
    });

    it("doit dimensionner un système 12V Plomb-acide pour site isolé", () => {
      const capacite = service.capaciteStockage("Plomb-acide", 500, 1, 12);
      expect(capacite.capacite.nominale_Ah).toBeCloseTo(83.3, 1);

      const modules = service.modulesBatteries(
        12,
        6,
        100,
        capacite.capacite.nominale_Ah
      );
      expect(modules.disposition.batteriesParString).toBe(2); // 12/6
      expect(modules.disposition.modulesEnParallele).toBe(1); // ceil(83.3/100)

      const bms = service.regulateurBMS(300, 12, 250, 0.95);
      expect(bms.IChargeMax).toBe(25);
      expect(bms.IBMSRecommande).toBe(40); // max(25, 21.93)*1.25=31.25 -> 40
    });
  });
});
