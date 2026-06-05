import { describe, it, expect, vi, afterEach } from "vitest";
import { StockageService } from "../../../services/installationPhotovoltaique/stockage.services.js";
import type { TechnologieBatterie } from "../../../types/installationPhotovoltaique.types.js";

describe("StockageService", () => {
  const service = new StockageService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // TESTS POUR capaciteStockage
  // ============================================================
  describe("capaciteStockage", () => {
    it("doit calculer la capacité pour LiFePO4 avec valeurs standard", () => {
      const result = service.capaciteStockage("LiFePO4", 6000, 2, 48);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data?.appareil).toBe("Batteries");
      expect(result.data?.typeBatterie).toBe("LiFePO4");
      expect(result.data?.DoDMax).toBe(0.8);
      expect(result.data?.autonomieJours).toBe(2);
      expect(result.data?.temperatureDeratingApplique).toBe(false);

      expect(result.data?.capacite.utile_Wh).toBe(12000);
      expect(result.data?.capacite.nominale_Wh).toBe(15000);
      expect(result.data?.capacite.nominale_Ah).toBe(312.5);

      expect(result.data?.cyclesDoDMax.min).toBe(3000);
      expect(result.data?.cyclesDoDMax.max).toBe(6000);
      expect(result.data?.plageTemperatureFonctionnement.min).toBe(0);
      expect(result.data?.plageTemperatureFonctionnement.max).toBe(55);
    });

    it("doit utiliser LiFePO4 par défaut si technologie non spécifiée", () => {
      const result = service.capaciteStockage(undefined as any, 5000, 1, 24);
      expect(result.success).toBe(true);
      expect(result.data?.typeBatterie).toBe("LiFePO4");
    });

    it("doit calculer correctement pour Plomb-acide", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 3, 24);

      expect(result.success).toBe(true);
      expect(result.data?.typeBatterie).toBe("Plomb-acide");
      expect(result.data?.DoDMax).toBe(0.5);
      expect(result.data?.capacite.utile_Wh).toBe(12000);
      expect(result.data?.capacite.nominale_Wh).toBe(24000);
      expect(result.data?.capacite.nominale_Ah).toBe(1000);

      expect(result.data?.cyclesDoDMax.min).toBe(300);
      expect(result.data?.cyclesDoDMax.max).toBe(700);
      expect(result.data?.plageTemperatureFonctionnement.min).toBe(-15);
      expect(result.data?.plageTemperatureFonctionnement.max).toBe(40);
    });

    it("doit calculer correctement pour AGM/Gel", () => {
      const result = service.capaciteStockage("AGM/Gel", 3000, 1, 12);

      expect(result.success).toBe(true);
      expect(result.data?.typeBatterie).toBe("AGM/Gel");
      expect(result.data?.DoDMax).toBe(0.5);
      expect(result.data?.capacite.utile_Wh).toBe(3000);
      expect(result.data?.capacite.nominale_Wh).toBe(6000);
      expect(result.data?.capacite.nominale_Ah).toBe(500);
    });

    it("doit calculer correctement pour Lithium NMC/NCA", () => {
      const result = service.capaciteStockage("Lithium NMC/NCA", 8000, 2, 48);

      expect(result.success).toBe(true);
      expect(result.data?.typeBatterie).toBe("Lithium NMC/NCA");
      expect(result.data?.DoDMax).toBe(0.8);
      expect(result.data?.capacite.utile_Wh).toBe(16000);
      expect(result.data?.capacite.nominale_Wh).toBe(20000);
      expect(result.data?.capacite.nominale_Ah).toBeCloseTo(416.7, 1);
    });

    it("doit calculer correctement pour NiCd", () => {
      const result = service.capaciteStockage("NiCd", 2000, 1, 24);

      expect(result.success).toBe(true);
      expect(result.data?.typeBatterie).toBe("NiCd");
      expect(result.data?.DoDMax).toBe(0.8);
      expect(result.data?.capacite.utile_Wh).toBe(2000);
      expect(result.data?.capacite.nominale_Wh).toBe(2500);
      expect(result.data?.capacite.nominale_Ah).toBeCloseTo(104.2, 1);
    });

    it("doit appliquer le dé-rating température pour Plomb-acide au-delà de 25°C", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 2, 24, 35);

      expect(result.success).toBe(true);
      expect(result.data?.temperatureDeratingApplique).toBe(true);
      expect(result.data?.capacite.nominale_Wh).toBe(17600);
    });

    it("doit appliquer le dé-rating critique pour Plomb-acide au-delà de 40°C", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 2, 24, 45);

      expect(result.success).toBe(true);
      expect(result.data?.temperatureDeratingApplique).toBe(true);
      expect(result.data?.capacite.nominale_Wh).toBe(20000);
    });

    it("doit clamp la température à 50°C pour le dé-rating", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 2, 24, 60);

      expect(result.success).toBe(true);
      expect(result.data?.temperatureDeratingApplique).toBe(true);
      expect(result.data?.capacite.nominale_Wh).toBe(21600);
    });

    it("ne doit pas appliquer de dé-rating si température ≤ 25°C", () => {
      const result = service.capaciteStockage("Plomb-acide", 4000, 2, 24, 20);

      expect(result.success).toBe(true);
      expect(result.data?.temperatureDeratingApplique).toBe(false);
      expect(result.data?.capacite.nominale_Wh).toBe(16000);
    });

    it("ne doit pas appliquer de dé-rating pour LiFePO4 même à haute température", () => {
      const result = service.capaciteStockage("LiFePO4", 6000, 2, 48, 45);

      expect(result.success).toBe(true);
      expect(result.data?.temperatureDeratingApplique).toBe(false);
      expect(result.data?.capacite.nominale_Wh).toBe(15000);
    });

    // Idées réactivées et adaptées au pattern du service
    it("doit rejeter une consommation journalière nulle", () => {
      const result = service.capaciteStockage("LiFePO4", 0, 2, 48);
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain("consommationJournaliere");
    });

    it("doit rejeter une consommation journalière négative", () => {
      const result = service.capaciteStockage("LiFePO4", -100, 2, 48);
      expect(result.success).toBe(false);
      expect(result.error).toContain("consommationJournaliere");
    });

    it("doit rejeter une autonomie nulle", () => {
      const result = service.capaciteStockage("LiFePO4", 5000, 0, 48);
      expect(result.success).toBe(false);
      expect(result.error).toContain("autonomie");
    });

    it("doit rejeter une tension système nulle", () => {
      const result = service.capaciteStockage("LiFePO4", 5000, 2, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("tensionSysteme");
    });

    it("doit rejeter une technologie non supportée", () => {
      const result = service.capaciteStockage(
        "Inconnue" as TechnologieBatterie,
        5000,
        2,
        48
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Technologie batterie non supportée");
    });

    it("doit gérer des valeurs décimales avec précision", () => {
      const result = service.capaciteStockage("LiFePO4", 1234.5, 1.5, 48);

      expect(result.success).toBe(true);
      expect(result.data?.capacite.utile_Wh).toBe(1852);
      expect(result.data?.capacite.nominale_Wh).toBe(2315);
      expect(result.data?.capacite.nominale_Ah).toBeCloseTo(48.2, 1);
    });

    it("doit gérer un projet industriel de grande consommation", () => {
      const result = service.capaciteStockage("LiFePO4", 500000, 3, 480);

      expect(result.success).toBe(true);
      expect(result.data?.capacite.utile_Wh).toBe(1500000);
      expect(result.data?.capacite.nominale_Wh).toBe(1875000);
      expect(result.data?.capacite.nominale_Ah).toBeCloseTo(3906.3, 1);
    });
  });

  // ============================================================
  // TESTS POUR modulesBatteries
  // ============================================================
  describe("modulesBatteries", () => {
    it("doit calculer la disposition pour un système 48V avec batteries 12V", () => {
      const result = service.modulesBatteries(48, 12, 100, 200);

      expect(result.success).toBe(true);
      expect(result.data?.appareil).toBe("Batteries");
      expect(result.data?.disposition.batteriesParString).toBe(4);
      expect(result.data?.disposition.modulesEnParallele).toBe(2);
      expect(result.data?.nombre).toBe(8);
    });

    it("doit calculer la disposition pour un système 24V avec batteries 6V", () => {
      const result = service.modulesBatteries(24, 6, 200, 400);

      expect(result.success).toBe(true);
      expect(result.data?.disposition.batteriesParString).toBe(4);
      expect(result.data?.disposition.modulesEnParallele).toBe(2);
      expect(result.data?.nombre).toBe(8);
    });

    it("doit calculer avec un seul string si capacité suffisante", () => {
      const result = service.modulesBatteries(48, 12, 300, 200);

      expect(result.success).toBe(true);
      expect(result.data?.disposition.batteriesParString).toBe(4);
      expect(result.data?.disposition.modulesEnParallele).toBe(1);
      expect(result.data?.nombre).toBe(4);
    });

    it("doit arrondir batteriesParString à l'entier le plus proche", () => {
      const result = service.modulesBatteries(48, 12.8, 100, 200);

      expect(result.success).toBe(true);
      expect(result.data?.disposition.batteriesParString).toBe(4);
    });

    it("doit émettre un warning si tension non multiple", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      service.modulesBatteries(50, 12, 100, 200);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0]?.[0]).toContain("non multiple");
    });

    // Idées réactivées et corrigées (success: false au lieu de toThrow)
    it("doit rejeter une tension système nulle", () => {
      const result = service.modulesBatteries(0, 12, 100, 200);
      expect(result.success).toBe(false);
      expect(result.error).toContain("tensionSysteme");
    });

    it("doit rejeter une tension batterie nulle", () => {
      const result = service.modulesBatteries(48, 0, 100, 200);
      expect(result.success).toBe(false);
      expect(result.error).toContain("tensionBatterie");
    });

    it("doit rejeter une capacité batterie nulle", () => {
      const result = service.modulesBatteries(48, 12, 0, 200);
      expect(result.success).toBe(false);
      expect(result.error).toContain("capaciteBatterie");
    });

    it("doit rejeter une capacité totale nulle (Correction de la ligne 186)", () => {
      const result = service.modulesBatteries(48, 12, 100, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("capaciteTotal");
    });

    it("doit gérer des valeurs décimales", () => {
      const result = service.modulesBatteries(48, 3.2, 280, 560);

      expect(result.success).toBe(true);
      expect(result.data?.disposition.batteriesParString).toBe(15);
      expect(result.data?.disposition.modulesEnParallele).toBe(2);
      expect(result.data?.nombre).toBe(30);
    });
  });

  // ============================================================
  // TESTS POUR regulateurBMS
  // ============================================================
  describe("regulateurBMS", () => {
    it("doit dimensionner le BMS pour un petit système", () => {
      const result = service.regulateurBMS(3000, 48, 2500, 0.98);

      expect(result.success).toBe(true);
      expect(result.data?.appareil).toBe("Battery Management System");
      expect(result.data?.IChargeMax).toBe(62.5);
      expect(result.data?.IDechargeMax).toBeCloseTo(53.15, 1);
      expect(result.data?.IBMSRecommande).toBe(80);
    });

    it("doit dimensionner le BMS quand courant charge > courant décharge", () => {
      const result = service.regulateurBMS(5000, 24, 1000, 0.95);

      expect(result.success).toBe(true);
      expect(result.data?.IChargeMax).toBeCloseTo(208.33, 1);
      expect(result.data?.IDechargeMax).toBeCloseTo(43.86, 1);
      expect(result.data?.IBMSRecommande).toBe(270);
    });

    it("doit dimensionner le BMS quand courant décharge > courant charge", () => {
      const result = service.regulateurBMS(2000, 48, 5000, 0.98);

      expect(result.success).toBe(true);
      expect(result.data?.IChargeMax).toBeCloseTo(41.67, 1);
      expect(result.data?.IDechargeMax).toBeCloseTo(106.3, 1);
      expect(result.data?.IBMSRecommande).toBe(140);
    });

    // Idées réactivées pour le regulateurBMS
    it("doit rejeter une puissance PV nulle", () => {
      const result = service.regulateurBMS(0, 48, 2000, 0.98);
      expect(result.success).toBe(false);
      expect(result.error).toContain("puissancePVCrete");
    });

    it("doit rejeter une tension batterie nulle", () => {
      const result = service.regulateurBMS(3000, 0, 2000, 0.98);
      expect(result.success).toBe(false);
      expect(result.error).toContain("tensionBatteries");
    });

    it("doit rejeter une puissance charge max nulle", () => {
      const result = service.regulateurBMS(3000, 48, 0, 0.98);
      expect(result.success).toBe(false);
      expect(result.error).toContain("puissanceChargeMax");
    });

    it("doit renvoyer une erreur si le rendement de l'onduleur est nul", () => {
      const result = service.regulateurBMS(3000, 48, 2000, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus)."
      );
    });

    it("doit lancer une erreur si le rendement de l'onduleur est supérieur à 1", () => {
      const result = service.regulateurBMS(3000, 48, 2000, 1.1);
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus)."
      );
    });

    it("doit lancer une erreur si le rendement de l'onduleur est négatif", () => {
      const result = service.regulateurBMS(3000, 48, 2000, -0.5);
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Le rendement de l'onduleur doit être compris entre 0 (exclus) et 1 (inclus)."
      );
    });

    it("doit gérer un rendement onduleur de 1 (100%)", () => {
      const result = service.regulateurBMS(1000, 24, 1000, 1.0);

      expect(result.success).toBe(true);
      expect(result.data?.IChargeMax).toBeCloseTo(41.67, 1);
      expect(result.data?.IDechargeMax).toBeCloseTo(41.67, 1);
      expect(result.data?.IBMSRecommande).toBe(60);
    });

    it("doit gérer un projet industriel de grande puissance", () => {
      const result = service.regulateurBMS(50000, 480, 40000, 0.98);

      expect(result.success).toBe(true);
      expect(result.data?.IChargeMax).toBeCloseTo(104.17, 1);
      expect(result.data?.IDechargeMax).toBeCloseTo(85.03, 1);
      expect(result.data?.IBMSRecommande).toBe(140);
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

      expect(result.success).toBe(true);
      expect(result.data?.capacite.utile_Wh).toBe(3086);
      expect(result.data?.capacite.nominale_Ah).toBeGreaterThan(0);
    });

    it("doit rejeter NaN dans les paramètres", () => {
      const result = service.capaciteStockage("LiFePO4", NaN, 2, 48);
      expect(result.success).toBe(false);
      expect(result.error).toContain("n'est pas un nombre valide");
    });

    it("doit rejeter Infinity dans les paramètres", () => {
      const result = service.capaciteStockage("LiFePO4", Infinity, 2, 48);
      expect(result.success).toBe(false);
      expect(result.error).toContain("n'est pas un nombre valide");
    });

    it("doit rejeter des valeurs manquantes (undefined)", () => {
      const result = service.capaciteStockage(
        "LiFePO4",
        undefined as any,
        2,
        48
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("est manquant");
    });
  });

  // ============================================================
  // TESTS D'INTÉGRATION
  // ============================================================
  describe("Tests d'intégration - Flux complet", () => {
    it("doit dimensionner un système de stockage complet 48V LiFePO4", () => {
      const capacite = service.capaciteStockage("LiFePO4", 6000, 2, 48);
      expect(capacite.success).toBe(true);
      expect(capacite.data?.capacite.nominale_Ah).toBe(312.5);

      const capaciteAh = capacite.data ? capacite.data.capacite.nominale_Ah : 0;

      const modules = service.modulesBatteries(48, 3.2, 100, capaciteAh);
      expect(modules.success).toBe(true);
      expect(modules.data?.disposition.batteriesParString).toBe(15);
      expect(modules.data?.disposition.modulesEnParallele).toBe(4);
      expect(modules.data?.nombre).toBe(60);

      const bms = service.regulateurBMS(5000, 48, 4000, 0.98);
      expect(bms.success).toBe(true);
      expect(bms.data?.IChargeMax).toBeCloseTo(104.17, 1);
      expect(bms.data?.IBMSRecommande).toBe(140);
    });

    it("doit dimensionner un système 12V Plomb-acide pour site isolé", () => {
      const capacite = service.capaciteStockage("Plomb-acide", 500, 1, 12);
      expect(capacite.success).toBe(true);
      expect(capacite.data?.capacite.nominale_Ah).toBeCloseTo(83.3, 1);

      const capaciteAh = capacite.data ? capacite.data.capacite.nominale_Ah : 0;

      const modules = service.modulesBatteries(12, 6, 100, capaciteAh);
      expect(modules.success).toBe(true);
      expect(modules.data?.disposition.batteriesParString).toBe(2);
      expect(modules.data?.disposition.modulesEnParallele).toBe(1);

      const bms = service.regulateurBMS(300, 12, 250, 0.95);
      expect(bms.success).toBe(true);
      expect(bms.data?.IChargeMax).toBe(25);
      expect(bms.data?.IBMSRecommande).toBe(40);
    });
  });
});
