import { describe, it, expect } from "vitest";
import { BilanConsommationService } from "../../../services/installationPhotovoltaique/bilanConso.services.js";
import type { Equipement } from "../../../types/installationPhotovoltaique.types.js";

describe("BilanConsommationService", () => {
  const service = new BilanConsommationService();

  // Jeu de données de test (Exemple typique Kinshasa)
  const mockEquipements: Equipement[] = [
    { nom: "Ampoules", P: 100, h: 6, k: 1 }, // 600 Wh
    { nom: "TV", P: 150, h: 4, k: 1 }, // 600 Wh
    { nom: "Frigo", P: 200, h: 24, k: 5 }, // 4800 Wh, Pic moteur x5
  ];

  // --- Tests pour energieTotal ---
  describe("energieTotal", () => {
    it("doit calculer l'énergie totale journalière correcte", () => {
      const total = service.energieTotal(mockEquipements);
      expect(total).toBe(600 + 600 + 4800); // 6000 Wh/j
    });

    it("doit retourner 0 si la liste d'équipements est vide", () => {
      expect(service.energieTotal([])).toBe(0);
    });

    it("doit gérer les équipements avec puissance ou durée nulle", () => {
      const eq = [{ nom: "Test", P: 0, h: 10, k: 1 }];
      expect(service.energieTotal(eq)).toBe(0);
    });
  });

  // --- Tests pour puissanceAppelee ---
  describe("puissanceAppelee", () => {
    it("doit appliquer le facteur de foisonnement par défaut (1)", () => {
      // P_crête_charge = (100*6/24) + (150*4/24) + (200*24/24)
      // = 25 + 25 + 200 = 250W
      // P_appelée = 250 * 0.8 = 200W
      const result = service.puissanceAppelee(mockEquipements, null);
      expect(result).toBe(250);
    });

    it("doit appliquer un facteur kf personnalisé (ex: 1.0)", () => {
      const result = service.puissanceAppelee(mockEquipements, 1.0);
      expect(result).toBe(250);
    });

    it("doit retourner 0 pour une liste vide", () => {
      expect(service.puissanceAppelee([], 0.8)).toBe(0);
    });
  });

  // --- Tests pour puissanceInstaleeAC ---
  describe("puissanceInstaleeAC", () => {
    it("doit sommer simplement toutes les puissances nominales", () => {
      const result = service.puissanceInstaleeAC(mockEquipements);
      expect(result).toBe(100 + 150 + 200); // 450W
    });

    it("doit gérer les nombres décimaux avec précision", () => {
      const eq = [{ nom: "Led", P: 9.5, h: 1, k: 1 }];
      expect(service.puissanceInstaleeAC(eq)).toBe(9.5);
    });
  });

  // --- Tests pour puissancePic ---
  describe("puissancePic", () => {
    it("doit calculer le pic total en tenant compte des coefficients de démarrage (k)", () => {
      // (100*1) + (150*1) + (200*5) = 100 + 150 + 1000 = 1250W
      const result = service.puissancePic(mockEquipements);
      expect(result).toBe(1250);
    });

    it("doit utiliser k=1 si k est undefined ou null (cas des charges résistives)", () => {
      const eq = [{ nom: "Fer à repasser", P: 1000, h: 1, k: undefined }];
      expect(service.puissancePic(eq)).toBe(1000);
    });

    it("doit gérer le cas où tous les k sont à 1", () => {
      const eq = [{ nom: "Lampe", P: 10, h: 5, k: 1 }];
      expect(service.puissancePic(eq)).toBe(10);
    });
  });

  // --- Tests de robustesse globale ---
  describe("Robustesse technique", () => {
    it("ne doit pas modifier l'objet initial (Immuabilité)", () => {
      const backup = JSON.stringify(mockEquipements);
      service.energieTotal(mockEquipements);
      service.puissanceAppelee(mockEquipements, 0.8);
      expect(JSON.stringify(mockEquipements)).toBe(backup);
    });

    it("doit gérer de très grandes valeurs (Projet industriel)", () => {
      const eqIndustrial = [{ nom: "Moteur", P: 50000, h: 24, k: 7 }]; // 50kW
      expect(service.puissancePic(eqIndustrial)).toBe(350000); // 350kW de pic
    });
  });
});
