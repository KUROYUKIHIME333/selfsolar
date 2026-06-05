import { describe, it, expect } from "vitest";
import { BilanConsommationService } from "../../../services/installationPhotovoltaique/bilanConso.services.js";
import type { Equipement } from "../../../types/installationPhotovoltaique.types.js";

describe("BilanConsommationService", () => {
  const service = new BilanConsommationService();

  // Messages d'erreur attendus définis dans le service
  const errorInvalide = "Liste des equipements invalide";
  const errorVide = "Liste des equipements vide";

  // Jeu de données nominal
  const mockEquipements: Equipement[] = [
    { nom: "Ampoules", P: 100, h: 6, k: 1 }, // E = 600 Wh  | P_pic = 100 W
    { nom: "TV", P: 150, h: 4, k: 1 }, // E = 600 Wh  | P_pic = 150 W
    { nom: "Frigo", P: 200, h: 24, k: 5 }, // E = 4800 Wh | P_pic = 1000 W
  ];

  // --- Validation stricte globale ---
  describe("Validation globale des entrées (validationEquipements)", () => {
    it("doit lever une exception si la liste d'équipements est vide", () => {
      // CORRECTION : Le service lève une vraie erreur (throw new Error), on utilise toThrowError
      expect(() => service.energieTotal([])).toThrowError(errorVide);
      expect(() => service.puissanceAppelee([], 0.8)).toThrowError(errorVide);
      expect(() => service.puissanceInstaleeAC([])).toThrowError(errorVide);
      expect(() => service.puissancePic([])).toThrowError(errorVide);
    });

    it("doit lever une exception si la liste est null ou undefined au runtime", () => {
      const inputsInvalides = [null, undefined];

      inputsInvalides.forEach((input) => {
        // CORRECTION : Capture du throw lors de l'exécution avec un type invalide au runtime
        expect(() =>
          service.energieTotal(input as unknown as Equipement[])
        ).toThrowError(errorInvalide);
      });
    });
  });

  // --- Tests pour energieTotal ---
  describe("energieTotal", () => {
    it("doit calculer l'énergie totale journalière nominale correcte", () => {
      const result = service.energieTotal(mockEquipements);
      expect(result.success).toBe(true);
      expect(result.data).toBe(600 + 600 + 4800); // 6000 Wh/j
    });

    it("doit ignorer les équipements avec une puissance ou une durée négative ou nulle", () => {
      const badEquipements: Equipement[] = [
        { nom: "Lampe OK", P: 10, h: 5, k: 1 }, // 50 Wh
        { nom: "P Négative", P: -100, h: 4, k: 1 }, // P <= 0 -> Ignoré (0 Wh)
        { nom: "h Négative", P: 100, h: -2, k: 1 }, // h <= 0 -> Ignoré (0 Wh)
        { nom: "Zéro", P: 0, h: 0, k: 1 }, // 0 Wh
      ];
      const result = service.energieTotal(badEquipements);
      expect(result.data).toBe(50);
    });

    it("doit ignorer proprement les types incorrects reçus au runtime", () => {
      const badTypes = [
        { nom: "Fake 1", P: "100" as unknown as number, h: 2, k: 1 }, // P n'est pas un number
        { nom: "Fake 2", P: 100, h: "2" as unknown as number, k: 1 }, // h n'est pas un number
      ];
      const result = service.energieTotal(badTypes);
      expect(result.data).toBe(0);
    });
  });

  // --- Tests pour puissanceAppelee ---
  describe("puissanceAppelee", () => {
    // Somme nominale P = 100 + 150 + 200 = 450W

    it("doit appliquer kf = 1 si kf est null, undefined ou invalide", () => {
      expect(
        service.puissanceAppelee(mockEquipements, null as unknown as number)
          .data
      ).toBe(450);
      expect(
        service.puissanceAppelee(
          mockEquipements,
          undefined as unknown as number
        ).data
      ).toBe(450);
      expect(service.puissanceAppelee(mockEquipements, -0.5).data).toBe(450);
      expect(service.puissanceAppelee(mockEquipements, 1.5).data).toBe(450);
    });

    it("doit appliquer correctement un facteur kf valide (ex: 0.8)", () => {
      // 450 * 0.8 = 360W
      const result = service.puissanceAppelee(mockEquipements, 0.8);
      expect(result.data).toBe(360);
    });

    it("doit appliquer un facteur kf limite à 1.0", () => {
      const result = service.puissanceAppelee(mockEquipements, 1.0);
      expect(result.data).toBe(450);
    });
  });

  // --- Tests pour puissanceInstaleeAC ---
  describe("puissanceInstaleeAC", () => {
    it("doit sommer simplement toutes les puissances nominales valides", () => {
      const result = service.puissanceInstaleeAC(mockEquipements);
      expect(result.data).toBe(450); // 100 + 150 + 200
    });

    it("doit exclure les puissances négatives du calcul global", () => {
      const mixed = [
        { nom: "A", P: 500, h: 2, k: 1 },
        { nom: "B", P: -500, h: 2, k: 1 }, // traité comme P = 0
      ];
      const result = service.puissanceInstaleeAC(mixed);
      expect(result.data).toBe(500);
    });
  });

  // --- Tests pour puissancePic ---
  describe("puissancePic", () => {
    it("doit calculer le pic total en multipliant chaque puissance par son coefficient de démarrage (k)", () => {
      // (100 * 1) + (150 * 1) + (200 * 5) = 100 + 150 + 1000 = 1250W
      const result = service.puissancePic(mockEquipements);
      expect(result.data).toBe(1250);
    });

    it("doit appliquer k = 1 par défaut si k est absent, null ou inférieur à 1", () => {
      const eqChargesChocs = [
        {
          nom: "Fer à repasser",
          P: 1000,
          h: 1,
          k: undefined as unknown as number,
        }, // k absent -> 1
        { nom: "PC Portable", P: 90, h: 8, k: 0.5 }, // k < 1 -> 1
        { nom: "Clim", P: 1500, h: 6, k: null as unknown as number }, // k null -> 1
      ];
      const result = service.puissancePic(eqChargesChocs);
      expect(result.data).toBe(1000 + 90 + 1500); // 2590W
    });
  });

  // --- Tests de précision numérique & Robustesse technique ---
  describe("Précision numérique & Robustesse technique", () => {
    it("doit éviter les résidus de virgule flottante binaire de JavaScript (Arrondis propres)", () => {
      const eqFlottants: Equipement[] = [
        { nom: "Lampe LED 1", P: 9.33, h: 1.5, k: 1.2 }, // E = 13.995, P_pic = 11.196
        { nom: "Lampe LED 2", P: 4.11, h: 0.7, k: 1.1 }, // E = 2.877,  P_pic = 4.521
      ];

      // Énergie attendue : 13.995 + 2.877 = 16.872 -> .toFixed(2) -> 16.87
      expect(service.energieTotal(eqFlottants).data).toBe(16.87);

      // Puissance Pic attendue : 11.196 + 4.521 = 15.717 -> .toFixed(2) -> 15.72
      expect(service.puissancePic(eqFlottants).data).toBe(15.72);
    });

    it("ne doit pas altérer par mutation le tableau d'équipements initial (Immuabilité)", () => {
      const originalState = JSON.stringify(mockEquipements);

      service.energieTotal(mockEquipements);
      service.puissanceAppelee(mockEquipements, 0.8);
      service.puissanceInstaleeAC(mockEquipements);
      service.puissancePic(mockEquipements);

      expect(JSON.stringify(mockEquipements)).toBe(originalState);
    });

    it("doit gérer de très grandes infrastructures sans débordement", () => {
      const grandReseau: Equipement[] = [
        { nom: "Chambre Froide", P: 45000, h: 24, k: 6.5 },
        { nom: "Pompe de distribution", P: 15000, h: 10, k: 4 },
      ];

      expect(service.energieTotal(grandReseau).data).toBe(1230000); // 1.23 MWh
      expect(service.puissanceInstaleeAC(grandReseau).data).toBe(60000);
    });
  });
});
