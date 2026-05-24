import { describe, it, expect, vi, afterEach } from "vitest";
import { CablageEtProtectionsService } from "../../../services/installationPhotovoltaique/cablageProtection.services.js";
import type {
  ParametresSTCPanneau,
  ResultatModulesPV,
} from "../../../types/installationPhotovoltaique.types.js";

describe("CablageEtProtectionsService", () => {
  const service = new CablageEtProtectionsService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Mocks de données réalistes ---
  const mockPanneau: ParametresSTCPanneau = {
    puissanceCreteModule: 450,
    tensionMPP: 41.2,
    tensionVoc: 49.8,
    courantMPP: 10.9,
    courantCourtCircuit: 11.5,
    coeffTempTension: -0.29,
    coeffTempPuissance: -0.35,
    noct: 45,
  };

  const mockModules: ResultatModulesPV = {
    appareil: "panneaux photovoltaiques",
    configuration: "haute_tension",
    panneauxParString: 12,
    stringsEnParallele: 2, // Moins de 3 strings -> pas de fusibles requis par défaut
    totalPanneaux: 24,
    tensionStringSTC: 494.4,
    tensionStringMin: 420.5,
    tensionStringMax: 528.3,
    vocStringFroid: 618.5,
    courantPVMin: 18.2,
    courantPVMax: 22.4,
    courantCourtCircuitPV: 23.0,
    puissancePVInstallee: {
      min: 7650,
      max: 11850,
      stc: 10800,
    },
    _temperaturesCellule: {
      tCellMin: 13,
      tCellMax: 76.25,
    },
    _modules: {
      vmppModuleChaud: 35.04,
      vmppModuleFroid: 44.03,
      vocModuleFroid: 51.54,
    },
  };

  // ============================================================
  // TESTS POUR dimensionnerCablesDC
  // ============================================================
  describe("dimensionnerCablesDC", () => {
    it("doit retourner un résultat conforme à l'interface ResultatDimensionnementDC", () => {
      const result = service.dimensionnerCablesDC(mockModules, mockPanneau);

      // Structure du câble String
      expect(result.cableString).toBeDefined();
      expect(result.cableString.courantEmploi_Ib).toBeGreaterThan(0);
      expect(result.cableString.facteurCorrectionK).toBeGreaterThan(0);
      expect(result.cableString.sectionConseillee_mm2).toBeGreaterThan(0);
      expect(result.cableString.chuteTension_Pourcent).toBeLessThanOrEqual(1.0); // Max 1% pour les strings

      // Structure du câble Principal
      expect(result.cablePrincipal).toBeDefined();
      expect(result.cablePrincipal.courantEmploi_Ib).toBeGreaterThan(0);
      expect(result.cablePrincipal.sectionConseillee_mm2).toBeGreaterThan(0);
      expect(result.cablePrincipal.chuteTension_Pourcent).toBeLessThanOrEqual(
        2.0
      ); // Max 2% pour le principal
    });

    it("doit calculer correctement les courants d'emploi Ib (Isc * 1.25)", () => {
      const result = service.dimensionnerCablesDC(
        mockModules,
        mockPanneau,
        15,
        10,
        30,
        "cuivre"
      );

      const courantStringAttendu = mockPanneau.courantCourtCircuit * 1.25;
      const courantPrincipalAttendu =
        mockPanneau.courantCourtCircuit * mockModules.stringsEnParallele * 1.25;

      expect(result.cableString.courantEmploi_Ib).toBeCloseTo(
        courantStringAttendu,
        1
      );
      expect(result.cablePrincipal.courantEmploi_Ib).toBeCloseTo(
        courantPrincipalAttendu,
        1
      );
    });

    it("doit dimensionner une section principale supérieure ou égale à la section string", () => {
      const result = service.dimensionnerCablesDC(
        mockModules,
        mockPanneau,
        15,
        10,
        45,
        "cuivre"
      );

      expect(
        result.cablePrincipal.sectionConseillee_mm2
      ).toBeGreaterThanOrEqual(result.cableString.sectionConseillee_mm2);
    });

    it("ne doit pas imposer de fusibles si le nombre de strings est inférieur à 3", () => {
      const modulesDeuxStrings = { ...mockModules, stringsEnParallele: 2 };
      const result = service.dimensionnerCablesDC(
        modulesDeuxStrings,
        mockPanneau
      );

      expect(result.protections.fusiblesStringsRequis).toBe(false);
      expect(result.protections.calibreFusibleString_A).toBe(0);
    });

    it("doit exiger des fusibles et calculer le calibre si le nombre de strings ≥ 3", () => {
      const modulesTroisStrings = { ...mockModules, stringsEnParallele: 3 };
      const result = service.dimensionnerCablesDC(
        modulesTroisStrings,
        mockPanneau
      );

      const calibreAttenduMin = Math.ceil(
        1.4 * mockPanneau.courantCourtCircuit
      );

      expect(result.protections.fusiblesStringsRequis).toBe(true);
      expect(result.protections.calibreFusibleString_A).toBe(calibreAttenduMin);
    });

    it("doit lever une erreur si les paramètres STC du panneau sont invalides", () => {
      const panneauInvalide = { ...mockPanneau, courantCourtCircuit: 0 };
      expect(() =>
        service.dimensionnerCablesDC(mockModules, panneauInvalide)
      ).toThrow();
    });
  });

  // ============================================================
  // TESTS POUR dimensionnerCablageAC
  // ============================================================
  describe("dimensionnerCablageAC", () => {
    it("doit correctement dimensionner un système monophasé", () => {
      const result = service.dimensionnerCablageAC(
        3000, // 3kW nominal
        230, // 230V
        false, // Monophasé
        20, // 20 mètres
        0.85, // cosPhi
        35, // 35°C ambiant
        "cuivre",
        "conduit_encastre"
      );

      expect(result.section).toBeGreaterThan(0);
      expect(result.courantEmploi).toBeCloseTo(3000 / (230 * 0.85), 2);
      expect(result.protection).toBeGreaterThan(result.courantEmploi);
      expect(result.chuteTension).toBeLessThanOrEqual(3.0); // Doit respecter la limite de 3%
      expect(result.ddr.type).toBe("B");
    });

    it("doit correctement dimensionner un système triphasé (courant plus faible à puissance égale)", () => {
      const resultMono = service.dimensionnerCablageAC(
        10000,
        400,
        false,
        30,
        0.9,
        30,
        "cuivre"
      );
      const resultTri = service.dimensionnerCablageAC(
        10000,
        400,
        true,
        30,
        0.9,
        30,
        "cuivre"
      );

      expect(resultTri.courantEmploi).toBeLessThan(resultMono.courantEmploi);
      expect(resultTri.section).toBeLessThanOrEqual(resultMono.section);
    });

    it("doit lever une erreur si la puissance de l'onduleur ou la tension réseau est nulle ou négative", () => {
      expect(() => service.dimensionnerCablageAC(0, 230, false, 10)).toThrow(
        "puissanceNominaleOnduleurWh invalide"
      );
      expect(() =>
        service.dimensionnerCablageAC(3000, -230, false, 10)
      ).toThrow("tensionReseauV invalide");
    });
  });

  // ============================================================
  // TESTS POUR verifierSelectivite
  // ============================================================
  describe("verifierSelectivite", () => {
    it("doit valider une sélectivité ampèremétrique quand le ratio amont/aval ≥ 1.6", () => {
      const protectionAmont = { calibre: 32, type: "disjoncteur" };
      const protectionAval = { calibre: 16, type: "fusible" };

      const result = service.verifierSelectivite(
        protectionAmont,
        protectionAval
      );

      expect(result.selectif).toBe(true);
      expect(result.typeSelectivite).toBe("ampèremétrique");
      expect(result.ratio).toBe(2);
      expect(result.commentaire).toContain(
        "Sélectivité ampèremétrique respectée"
      );
    });

    it("doit valider une sélectivité chronométrique si l'amont est temporisé par rapport à l'aval", () => {
      const protectionAmont = {
        calibre: 25,
        type: "disjoncteur",
        temporisation: 100,
      };
      const protectionAval = {
        calibre: 20,
        type: "disjoncteur",
        temporisation: 0,
      };

      const result = service.verifierSelectivite(
        protectionAmont,
        protectionAval
      );

      expect(result.selectif).toBe(true);
      expect(result.typeSelectivite).toBe("chronométrique");
      expect(result.commentaire).toContain(
        "Sélectivité chronométrique respectée"
      );
    });

    it("doit rejeter la sélectivité si le ratio est insuffisant et sans décalage temporel", () => {
      const protectionAmont = { calibre: 20, type: "disjoncteur" };
      const protectionAval = { calibre: 16, type: "disjoncteur" }; // Ratio = 1.25 (< 1.6)

      const result = service.verifierSelectivite(
        protectionAmont,
        protectionAval
      );

      expect(result.selectif).toBe(false);
      expect(result.typeSelectivite).toBe("aucune");
      expect(result.commentaire).toContain(
        "Risque de déclenchement intempestif"
      );
    });

    it("doit gérer les calibres invalides de manière robuste", () => {
      const result = service.verifierSelectivite(
        { calibre: 0, type: "disjoncteur" },
        { calibre: 16, type: "fusible" }
      );
      expect(result.commentaire).toBe("Calibres invalides");
    });
  });
});
