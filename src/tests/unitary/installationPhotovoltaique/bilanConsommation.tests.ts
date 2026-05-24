import { describe, it, expect } from "vitest";
import { BilanConsommationService } from "../../../services/installationPhotovoltaique/bilanConso.services.js";
import type { Equipement } from "../../../types/installationPhotovoltaique.types.js";

describe("BilanConsommationService", () => {
  const service = new BilanConsommationService();

  // Jeu de données nominal (Exemple typique Kinshasa)
  const mockEquipements: Equipement[] = [
    { nom: "Ampoules", P: 100, h: 6, k: 1 }, // 600 Wh
    { nom: "TV", P: 150, h: 4, k: 1 }, // 600 Wh
    { nom: "Frigo", P: 200, h: 24, k: 5 }, // 4800 Wh, Pic moteur x5
  ];

  // --- Tests pour energieTotal ---
  describe("energieTotal", () => {
    it("doit calculer l'énergie totale journalière nominale correcte", () => {
      const total = service.energieTotal(mockEquipements);
      expect(total).toBe(600 + 600 + 4800); // 6000 Wh/j
    });

    it("doit retourner 0 si la liste d'équipements est vide ou invalide", () => {
      expect(service.energieTotal([])).toBe(0);
      expect(service.energieTotal(null as unknown as Equipement[])).toBe(0);
      expect(service.energieTotal(undefined as unknown as Equipement[])).toBe(
        0
      );
    });

    it("doit ignorer les équipements avec une puissance ou une durée négative ou nulle", () => {
      const badEquipements: Equipement[] = [
        { nom: "Lampe OK", P: 10, h: 5, k: 1 }, // 50 Wh
        { nom: "P Négative", P: -100, h: 4, k: 1 }, // ignoré (0)
        { nom: "h Négative", P: 100, h: -2, k: 1 }, // ignoré (0)
        { nom: "Zéro", P: 0, h: 0, k: 1 }, // ignoré (0)
      ];
      expect(service.energieTotal(badEquipements)).toBe(50);
    });

    it("doit ignorer proprement les types incorrects reçus au runtime", () => {
      const badTypes = [
        { nom: "Fake 1", P: "100" as unknown as number, h: 2, k: 1 },
        { nom: "Fake 2", P: 100, h: "2" as unknown as number, k: 1 },
      ];
      expect(service.energieTotal(badTypes)).toBe(0);
    });
  });

  // --- Tests pour puissanceAppelee ---
  describe("puissanceAppelee", () => {
    // Somme nominale P = 100 + 150 + 200 = 450W

    it("doit appliquer kf = 1 si kf est null, undefined ou invalide", () => {
      expect(service.puissanceAppelee(mockEquipements, null)).toBe(450);
      expect(service.puissanceAppelee(mockEquipements, undefined)).toBe(450);
      expect(service.puissanceAppelee(mockEquipements, -0.5)).toBe(450);
      expect(service.puissanceAppelee(mockEquipements, 1.5)).toBe(450);
    });

    it("doit appliquer correctement un facteur kf valide (ex: 0.8 selon NFC 15-100)", () => {
      // 450 * 0.8 = 360W
      const result = service.puissanceAppelee(mockEquipements, 0.8);
      expect(result).toBe(360);
    });

    it("doit appliquer un facteur kf limite à 1.0", () => {
      const result = service.puissanceAppelee(mockEquipements, 1.0);
      expect(result).toBe(450);
    });

    it("doit retourner 0 pour une liste vide ou non-conforme", () => {
      expect(service.puissanceAppelee([], 0.8)).toBe(0);
      expect(
        service.puissanceAppelee(null as unknown as Equipement[], 0.8)
      ).toBe(0);
    });
  });

  // --- Tests pour puissanceInstaleeAC ---
  describe("puissanceInstaleeAC", () => {
    it("doit sommer simplement toutes les puissances nominales valides", () => {
      const result = service.puissanceInstaleeAC(mockEquipements);
      expect(result).toBe(450); // 100 + 150 + 200
    });

    it("doit retourner 0 pour une liste vide ou invalide", () => {
      expect(service.puissanceInstaleeAC([])).toBe(0);
      expect(
        service.puissanceInstaleeAC(undefined as unknown as Equipement[])
      ).toBe(0);
    });

    it("doit exclure les puissances négatives du calcul global", () => {
      const mixed = [
        { nom: "A", P: 500, h: 2 },
        { nom: "B", P: -500, h: 2 },
      ];
      expect(service.puissanceInstaleeAC(mixed)).toBe(500);
    });
  });

  // --- Tests pour puissancePic ---
  describe("puissancePic", () => {
    it("doit calculer le pic total en multipliant chaque puissance par son coefficient de démarrage (k)", () => {
      // (100 * 1) + (150 * 1) + (200 * 5) = 100 + 150 + 1000 = 1250W
      const result = service.puissancePic(mockEquipements);
      expect(result).toBe(1250);
    });

    it("doit appliquer k = 1 par défaut si k est absent, null ou inférieur à 1", () => {
      const eqChargesChocs = [
        { nom: "Fer à repasser", P: 1000, h: 1, k: undefined }, // k=1 -> 1000W
        { nom: "PC Portable", P: 90, h: 8, k: 0.5 }, // k < 1 -> k=1 -> 90W
        { nom: "Clim", P: 1500, h: 6, k: null as unknown as number }, // k invalide -> k=1 -> 1500W
      ];
      expect(service.puissancePic(eqChargesChocs)).toBe(1000 + 90 + 1500); // 2590W
    });

    it("doit retourner 0 pour une liste vide ou invalide", () => {
      expect(service.puissancePic([])).toBe(0);
      expect(service.puissancePic(null as unknown as Equipement[])).toBe(0);
    });
  });

  // --- Tests de précision numérique & Robustesse technique ---
  describe("Précision numérique & Robustesse technique", () => {
    it("doit éviter les résidus de virgule flottante binaire de JavaScript (Arrondis propres)", () => {
      // Évite les pièges comme 0.1 + 0.2 = 0.30000000000000004
      const eqFlottants: Equipement[] = [
        { nom: "Lampe LED 1", P: 9.33, h: 1.5, k: 1.2 }, // P*h = 13.995, P*k = 11.196
        { nom: "Lampe LED 2", P: 4.11, h: 0.7, k: 1.1 }, // P*h = 2.877,  P*k = 4.521
      ];

      // Énergie totale brute attendue : 13.995 + 2.877 = 16.872 -> Arrondi à 16.87
      expect(service.energieTotal(eqFlottants)).toBe(16.87);

      // Puissance Pic brute attendue : 11.196 + 4.521 = 15.717 -> Arrondi à 15.72
      expect(service.puissancePic(eqFlottants)).toBe(15.72);

      // Puissance installée brute attendue : 9.33 + 4.11 = 13.44
      expect(service.puissanceInstaleeAC(eqFlottants)).toBe(13.44);
    });

    it("ne doit pas altérer par mutation le tableau d'équipements initial (Immuabilité)", () => {
      const originalState = JSON.stringify(mockEquipements);

      service.energieTotal(mockEquipements);
      service.puissanceAppelee(mockEquipements, 0.8);
      service.puissanceInstaleeAC(mockEquipements);
      service.puissancePic(mockEquipements);

      expect(JSON.stringify(mockEquipements)).toBe(originalState);
    });

    it("doit gérer de très grandes infrastructures sans débordement (Projet mini-réseau industriel)", () => {
      const miniReseauGoma: Equipement[] = [
        { nom: "Chambre Froide Industrielle", P: 45000, h: 24, k: 6.5 }, // P_pic = 292500W, E = 1080000Wh
        { nom: "Pompe à eau Distribution", P: 15000, h: 10, k: 4 }, // P_pic = 60000W,  E = 150000Wh
        { nom: "Éclairage Public Zone", P: 8500, h: 12, k: 1 }, // P_pic = 8500W,   E = 102000Wh
      ];

      expect(service.energieTotal(miniReseauGoma)).toBe(1332000); // 1.332 MWh/j
      expect(service.puissanceInstaleeAC(miniReseauGoma)).toBe(68500); // 68.5 kW
      expect(service.puissancePic(miniReseauGoma)).toBe(361000); // 361 kW de pointe transitoire
    });
  });
});
