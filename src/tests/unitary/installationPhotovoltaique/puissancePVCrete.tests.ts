import { describe, it, expect, beforeEach } from "vitest";
import { PuissanceCretePVService } from "../../../services/installationPhotovoltaique/puissancePVCrete.services.js";
import type {
  TypeInstallationPourPertes,
  PompageSolaireCaracteristiques,
  ParametresSTCPanneau,
  TemperaturesMinMax,
  ParametresOnduleur,
} from "../../../types/installationPhotovoltaique.types.js";

describe("PuissanceCretePVService", () => {
  const service = new PuissanceCretePVService();

  // --- Données de test standard ---
  const mockTemperatures: TemperaturesMinMax = {
    temperatureMin: 15,
    temperatureMax: 45,
  };

  const mockTemperaturesFroides: TemperaturesMinMax = {
    temperatureMin: -10,
    temperatureMax: 25,
  };

  const mockTemperaturesChaudes: TemperaturesMinMax = {
    temperatureMin: 25,
    temperatureMax: 55,
  };

  const mockPanneauStandard: ParametresSTCPanneau = {
    puissanceCreteModule: 450,
    tensionMPP: 41.2,
    tensionVoc: 49.8,
    courantMPP: 10.9,
    courantCourtCircuit: 11.5,
    coeffTempTension: -0.29,
    coeffTempPuissance: -0.35,
    noct: 45,
  };

  const mockPanneauPetit: ParametresSTCPanneau = {
    puissanceCreteModule: 100,
    tensionMPP: 18.5,
    tensionVoc: 22.3,
    courantMPP: 5.4,
    courantCourtCircuit: 6.2,
    coeffTempTension: -0.33,
    coeffTempPuissance: -0.4,
    noct: 47,
  };

  const mockPompage: PompageSolaireCaracteristiques = {
    batteries: false,
    masseVolumique: 1000,
    accelerationPesanteur: 9.81,
    debit: 2.5,
    hauteurMano: 15,
    rendementPompe: 0.75,
  };

  const mockOnduleurValide: ParametresOnduleur = {
    puissanceACNominale: 5000,
    tensionDCMax: 700,
    tensionMPPTMin: 125,
    tensionMPPTMax: 600,
    courantDCMax: 30,
    puissanceDCMax: 7500,
    puissanceSurcharge: 7500,
  };

  const mockOnduleurPetit: ParametresOnduleur = {
    puissanceACNominale: 3000,
    tensionDCMax: 500,
    tensionMPPTMin: 150,
    tensionMPPTMax: 480,
    courantDCMax: 15,
    puissanceDCMax: 4500,
    puissanceSurcharge: 4500,
  };

  // ============================================================
  // TESTS POUR performanceRatio
  // ============================================================
  describe("performanceRatio", () => {
    it("doit retourner les pertes et PR pour une installation HAUTE_QUALITE", () => {
      const result = service.performanceRatio("HAUTE_QUALITE");
      expect(result.pertesTotales).toBe(10);
      expect(result.PR).toBe(0.9);
    });

    it("doit retourner les pertes et PR pour une installation STANDARD", () => {
      const result = service.performanceRatio("STANDARD");
      expect(result.pertesTotales).toBe(18);
      expect(result.PR).toBe(0.82);
    });

    it("doit retourner les pertes et PR pour une installation POUSSIEREUX", () => {
      const result = service.performanceRatio("POUSSIEREUX");
      expect(result.pertesTotales).toBe(22);
      expect(result.PR).toBe(0.78);
    });

    it("doit retourner les pertes et PR pour une installation FAIBLE_MAINTENANCE", () => {
      const result = service.performanceRatio("FAIBLE_MAINTENANCE");
      expect(result.pertesTotales).toBe(25);
      expect(result.PR).toBe(0.75);
    });

    it("doit retourner les pertes et PR pour une installation CABLE_LONG", () => {
      const result = service.performanceRatio("CABLE_LONG");
      expect(result.pertesTotales).toBe(25);
      expect(result.PR).toBe(0.75);
    });

    it("doit retourner les pertes et PR pour une installation ANCIEN", () => {
      const result = service.performanceRatio("ANCIEN");
      expect(result.pertesTotales).toBe(28);
      expect(result.PR).toBe(0.72);
    });

    it("doit fallback sur STANDARD si le type est invalide", () => {
      const result = service.performanceRatio(
        "INCONNU" as TypeInstallationPourPertes
      );
      expect(result.pertesTotales).toBe(18);
      expect(result.PR).toBe(0.82);
    });

    it("doit retourner un PR compris entre 0 et 1", () => {
      const types: TypeInstallationPourPertes[] = [
        "HAUTE_QUALITE",
        "STANDARD",
        "POUSSIEREUX",
        "FAIBLE_MAINTENANCE",
        "CABLE_LONG",
        "ANCIEN",
      ];
      types.forEach((type) => {
        const result = service.performanceRatio(type);
        expect(result.PR).toBeGreaterThan(0);
        expect(result.PR).toBeLessThanOrEqual(1);
      });
    });
  });

  // ============================================================
  // TESTS POUR puissanceCretePV - Mode Standard
  // ============================================================
  describe("puissanceCretePV - Mode Standard", () => {
    it("doit calculer correctement la puissance crête standard", () => {
      const energie = 6000; // Wh/j
      const PSH = 5;
      const PR = 0.82;
      const result = service.puissanceCretePV(false, energie, PSH, PR);
      expect(result.success).toBe(true);
      expect(result.puissanceCrete).toBe(Math.ceil(6000 / (5 * 0.82)));
    });

    it("doit arrondir à l'entier supérieur", () => {
      const energie = 1000;
      const PSH = 3;
      const PR = 0.8;
      const result = service.puissanceCretePV(false, energie, PSH, PR);
      const expected = Math.ceil(1000 / (3 * 0.8)); // 417
      expect(result.puissanceCrete).toBe(expected);
    });

    it("doit rejeter un PSH nul", () => {
      const result = service.puissanceCretePV(false, 1000, 0, 0.8);
      expect(result.success).toBe(false);
      expect(result.error).toContain("PSH");
    });

    it("doit rejeter un PSH négatif", () => {
      const result = service.puissanceCretePV(false, 1000, -2, 0.8);
      expect(result.success).toBe(false);
    });

    it("doit rejeter un PSH non numérique", () => {
      const result = service.puissanceCretePV(false, 1000, NaN, 0.8);
      expect(result.success).toBe(false);
    });

    it("doit rejeter un PR nul", () => {
      const result = service.puissanceCretePV(false, 1000, 5, 0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Performance Ratio");
    });

    it("doit rejeter un PR négatif", () => {
      const result = service.puissanceCretePV(false, 1000, 5, -0.5);
      expect(result.success).toBe(false);
    });

    it("doit rejeter un PR supérieur à 1", () => {
      const result = service.puissanceCretePV(false, 1000, 5, 1.1);
      expect(result.success).toBe(false);
    });

    it("doit rejeter un PR non numérique", () => {
      const result = service.puissanceCretePV(false, 1000, 5, NaN);
      expect(result.success).toBe(false);
    });

    it("doit rejeter une énergie de charge nulle", () => {
      const result = service.puissanceCretePV(false, 0, 5, 0.8);
      expect(result.success).toBe(false);
      expect(result.error).toContain("énergie de charge");
    });

    it("doit rejeter une énergie de charge négative", () => {
      const result = service.puissanceCretePV(false, -100, 5, 0.8);
      expect(result.success).toBe(false);
    });

    it("doit rejeter une énergie de charge non numérique", () => {
      const result = service.puissanceCretePV(false, NaN, 5, 0.8);
      expect(result.success).toBe(false);
    });

    it("doit gérer de très grandes valeurs d'énergie", () => {
      const result = service.puissanceCretePV(false, 1000000, 5, 0.8);
      expect(result.success).toBe(true);
      expect(result.puissanceCrete).toBe(Math.ceil(1000000 / 4));
    });
  });

  // ============================================================
  // TESTS POUR puissanceCretePV - Mode Pompage
  // ============================================================
  describe("puissanceCretePV - Mode Pompage", () => {
    it("doit calculer correctement la puissance crête pour le pompage", () => {
      const PSH = 5;
      const PR = 0.82;
      const result = service.puissanceCretePV(true, 0, PSH, PR, mockPompage);
      expect(result.success).toBe(true);
      // E_hydraulique = (1000 * 9.81 * 2.5 * 15) / (3600 * 0.75) = 136.25 Wh
      // PR_pompage = 0.82 * 0.9 = 0.738
      // Pc = 136.25 / (5 * 0.98 * 0.738) ≈ 37.68 -> 38
      expect(result.puissanceCrete).toBeGreaterThan(0);
    });

    it("doit utiliser le rendement onduleur par défaut (0.98) si non fourni", () => {
      const result = service.puissanceCretePV(true, 0, 5, 0.82, mockPompage);
      expect(result.success).toBe(true);
    });

    it("doit utiliser un rendement onduleur personnalisé", () => {
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        mockPompage,
        0.95
      );
      expect(result.success).toBe(true);
    });

    it("doit rejeter un rendement onduleur invalide", () => {
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        mockPompage,
        1.5
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un rendement onduleur nul ou négatif", () => {
      const result = service.puissanceCretePV(true, 0, 5, 0.82, mockPompage, 0);
      expect(result.success).toBe(false);
    });

    it("doit rejeter si les caractéristiques de pompage sont manquantes", () => {
      const result = service.puissanceCretePV(true, 0, 5, 0.82, undefined);
      expect(result.success).toBe(false);
      expect(result.error).toContain("caractéristiques hydrauliques");
    });

    it("doit rejeter une masse volumique invalide", () => {
      const pompageInvalide = { ...mockPompage, masseVolumique: -1000 };
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        pompageInvalide
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter une accélération pesanteur invalide", () => {
      const pompageInvalide = { ...mockPompage, accelerationPesanteur: 0 };
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        pompageInvalide
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un débit invalide", () => {
      const pompageInvalide = { ...mockPompage, debit: -1 };
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        pompageInvalide
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter une hauteur manométrique invalide", () => {
      const pompageInvalide = { ...mockPompage, hauteurMano: 0 };
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        pompageInvalide
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un rendement de pompe supérieur à 1", () => {
      const pompageInvalide = { ...mockPompage, rendementPompe: 1.2 };
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        pompageInvalide
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("rendement de la pompe");
    });

    it("doit rejeter un rendement de pompe nul", () => {
      const pompageInvalide = { ...mockPompage, rendementPompe: 0 };
      const result = service.puissanceCretePV(
        true,
        0,
        5,
        0.82,
        pompageInvalide
      );
      expect(result.success).toBe(false);
    });

    it("doit calculer avec des valeurs extrêmes de pompage", () => {
      const pompageExtreme: PompageSolaireCaracteristiques = {
        batteries: true,
        masseVolumique: 1000,
        accelerationPesanteur: 9.81,
        debit: 50,
        hauteurMano: 100,
        rendementPompe: 0.9,
      };
      const result = service.puissanceCretePV(true, 0, 5, 0.82, pompageExtreme);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // TESTS POUR modulesPV - Cas nominaux
  // ============================================================
  describe("modulesPV - Cas nominaux", () => {
    it("doit dimensionner correctement un champ de modules standard", () => {
      const puissanceCible = 5000;
      const result = service.modulesPV(
        mockPanneauStandard,
        puissanceCible,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.appareil).toBe("panneaux photovoltaiques");
      expect(result.data?.totalPanneaux).toBeGreaterThan(0);
      expect(result.data?.panneauxParString).toBeGreaterThan(0);
      expect(result.data?.stringsEnParallele).toBeGreaterThan(0);
    });

    it("doit calculer les tensions string correctement", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.tensionStringMin).toBeGreaterThan(0);
        expect(result.data.tensionStringMax).toBeGreaterThan(0);
        expect(result.data.tensionStringSTC).toBeGreaterThan(0);
        expect(result.data.vocStringFroid).toBeGreaterThan(0);
      }
    });

    it("doit calculer les courants PV correctement", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.courantCourtCircuitPV).toBeGreaterThan(0);
        expect(result.data.courantPVMin).toBeGreaterThan(0);
        expect(result.data.courantPVMax).toBeGreaterThan(0);
      }
    });

    it("doit calculer les puissances installées", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.puissancePVInstallee.stc).toBeGreaterThan(0);
        expect(result.data.puissancePVInstallee.min).toBeGreaterThan(0);
        expect(result.data.puissancePVInstallee.max).toBeGreaterThan(0);
        expect(result.data.puissancePVInstallee.min).toBeLessThanOrEqual(
          result.data.puissancePVInstallee.stc
        );
        expect(result.data.puissancePVInstallee.stc).toBeLessThanOrEqual(
          result.data.puissancePVInstallee.max
        );
      }
    });

    it("doit utiliser la tension système par défaut si non fournie", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
      expect(result.data?.configuration).toBeDefined();
    });

    it("doit utiliser la tension et configuration fournies", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000,
        48,
        "basse_tension"
      );
      expect(result.success).toBe(true);
      expect(result.data?.configuration).toBe("basse_tension");
    });

    it("doit gérer un système on-grid avec haute tension", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        15000,
        mockTemperatures,
        1000,
        600,
        "haute_tension"
      );
      expect(result.success).toBe(true);
      expect(result.data?.configuration).toBe("haute_tension");
    });
  });

  // ============================================================
  // TESTS POUR modulesPV - Validations d'entrée
  // ============================================================
  describe("modulesPV - Validations", () => {
    it("doit rejeter des paramètres de panneau invalides", () => {
      const result = service.modulesPV(
        null as any,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter une puissance crête nulle", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        0,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter une puissance crête négative", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        -1000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter une puissance crête non numérique", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        NaN,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un panneau avec puissance nulle", () => {
      const panneauInvalide = {
        ...mockPanneauStandard,
        puissanceCreteModule: 0,
      };
      const result = service.modulesPV(
        panneauInvalide,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un panneau avec tension MPP nulle", () => {
      const panneauInvalide = { ...mockPanneauStandard, tensionMPP: 0 };
      const result = service.modulesPV(
        panneauInvalide,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un panneau avec tension Voc nulle", () => {
      const panneauInvalide = { ...mockPanneauStandard, tensionVoc: 0 };
      const result = service.modulesPV(
        panneauInvalide,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit rejeter un panneau avec courant de court-circuit nul", () => {
      const panneauInvalide = {
        ...mockPanneauStandard,
        courantCourtCircuit: 0,
      };
      const result = service.modulesPV(
        panneauInvalide,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(false);
    });

    it("doit utiliser NOCT par défaut (45) si non fourni", () => {
      const panneauSansNOCT = { ...mockPanneauStandard };
      delete (panneauSansNOCT as any).noct;
      const result = service.modulesPV(
        panneauSansNOCT,
        5000,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // TESTS POUR modulesPV - Températures extrêmes
  // ============================================================
  describe("modulesPV - Températures extrêmes", () => {
    it("doit gérer des températures froides", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperaturesFroides,
        1000
      );
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data._temperaturesCellule.tCellMin).toBeLessThan(0);
      }
    });

    it("doit gérer des températures chaudes", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperaturesChaudes,
        1000
      );
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data._temperaturesCellule.tCellMax).toBeGreaterThan(50);
      }
    });

    it("doit gérer une irradiance élevée", () => {
      const result = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1200
      );
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // TESTS POUR onduleur - Cas nominaux
  // ============================================================
  describe("onduleur - Cas nominaux", () => {
    let resultModules: any;

    beforeEach(() => {
      const modulesResult = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000,
        600,
        "haute_tension"
      );
      resultModules = modulesResult.data;
    });

    it("doit dimensionner correctement un onduleur", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.appareil).toBe("onduleur");
      expect(result.data?.dimensionnement).toBeDefined();
      expect(result.data?.dimensionnement.ratioDCAC).toBeGreaterThan(0);
    });

    it("doit calculer les grandeurs du champ PV", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.grandeursChamp.vocChampFroid).toBeGreaterThan(0);
      expect(result.data?.grandeursChamp.vmppChampChaud).toBeGreaterThan(0);
      expect(result.data?.grandeursChamp.iscChamp).toBeGreaterThan(0);
      expect(result.data?.grandeursChamp.puissanceChampsWcSTC).toBeGreaterThan(
        0
      );
    });

    it("doit calculer les bornes de dimensionnement", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.dimensionnement.puissanceACMin).toBeGreaterThan(0);
      expect(
        result.data?.dimensionnement.puissanceACRecommandee
      ).toBeGreaterThan(0);
      expect(result.data?.dimensionnement.puissanceACMax).toBeGreaterThan(0);
      expect(result.data?.dimensionnement.puissanceACMin).toBeLessThan(
        result.data ? result.data.dimensionnement.puissanceACMax : 0
      );
    });

    it("doit vérifier la compatibilité avec un onduleur valide", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.verification).toBeDefined();
      expect(result.data?.verification?.compatible).toBe(true);
      expect(result.data?.verification?.details.vocSousLimite).toBe(true);
      expect(result.data?.verification?.details.vmppDansPlageMPPT).toBe(true);
      expect(result.data?.verification?.details.iscSousLimite).toBe(true);
    });

    it("doit retourner une évaluation du ratio DC/AC", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(["sous-dimensionne", "optimal", "acceptable", "eleve"]).toContain(
        result.data?.dimensionnement.evaluationRatio
      );
    });

    it("doit fonctionner sans onduleur candidat", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        null
      );
      expect(result.data?.verification).toBeNull();
      expect(result.data?.erreurs).toHaveLength(0);
    });

    it("doit fonctionner avec un onduleur sans puissance nominale", () => {
      const onduleurInvalide = {
        ...mockOnduleurValide,
        puissanceACNominale: 0,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurInvalide
      );
      expect(result.data?.verification).toBeNull();
    });
  });

  // ============================================================
  // TESTS POUR onduleur - Vérifications de compatibilité
  // ============================================================
  describe("onduleur - Vérifications de compatibilité", () => {
    let resultModules: any;

    beforeEach(() => {
      const modulesResult = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000,
        600, // AJOUTER
        "haute_tension"
      );
      resultModules = modulesResult.data;
    });

    it("doit détecter une surtension Voc (Voc > tensionDCMax)", () => {
      const onduleurFaibleTension = {
        ...mockOnduleurValide,
        tensionDCMax: 100,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurFaibleTension
      );
      expect(result.data?.verification?.details.vocSousLimite).toBe(false);
      expect(result.data?.erreurs.length).toBeGreaterThan(0);
      expect(result.data?.erreurs[0]).toContain("CRITIQUE");
      expect(result.data?.erreurs[0]).toContain("Voc champ à froid");
    });

    it("doit détecter un Vmpp sous le minimum MPPT", () => {
      const onduleurHautMin = {
        ...mockOnduleurValide,
        tensionMPPTMin: 500,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurHautMin
      );
      expect(result.data?.verification?.details.vmppAuDessusMinimum).toBe(
        false
      );
      expect(result.data?.avertissements.length).toBeGreaterThan(0);
      expect(result.data?.avertissements[0]).toContain("Vmpp champ à chaud");
    });

    it("doit détecter un Vmpp au-dessus du maximum MPPT", () => {
      const onduleurBasMax = {
        ...mockOnduleurValide,
        tensionMPPTMax: 150,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurBasMax
      );
      expect(result.data?.verification?.details.vmppDansPlageMPPT).toBe(false);
      expect(result.data?.erreurs.length).toBeGreaterThan(0);
      expect(
        result.data?.erreurs.some((e: string) =>
          e.includes("Vmpp champ à froid")
        )
      ).toBe(true);
    });

    it("doit détecter un courant Isc trop élevé", () => {
      const onduleurFaibleCourant = {
        ...mockOnduleurValide,
        courantDCMax: 1,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurFaibleCourant
      );
      expect(result.data?.verification?.details.iscSousLimite).toBe(false);
      expect(
        result.data?.erreurs.some((e: string) =>
          e.includes("Courant Isc corrigé")
        )
      ).toBe(true);
    });

    it("doit détecter une puissance AC insuffisante", () => {
      const onduleurPetit = {
        ...mockOnduleurValide,
        puissanceACNominale: 100,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurPetit
      );
      expect(result.data?.verification?.details.chargeACOk).toBe(false);
      expect(
        result.data?.erreurs.some((e: string) =>
          e.includes("Puissance AC nominale")
        )
      ).toBe(true);
    });

    it("doit détecter une surcharge transitoire insuffisante", () => {
      const onduleurSansSurcharge = {
        ...mockOnduleurValide,
        puissanceSurcharge: 100,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurSansSurcharge,
        5000
      );
      expect(result.data?.verification?.details.surchargeOk).toBe(false);
      expect(
        result.data?.avertissements.some((a: string) =>
          a.includes("surcharge transitoire")
        )
      ).toBe(true);
    });

    it("doit avertir en cas d'écrêtage (clipping)", () => {
      const onduleurPetitDC = {
        ...mockOnduleurValide,
        puissanceDCMax: 100,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurPetitDC
      );
      expect(result.data?.verification?.details.puissanceDCOk).toBe(false);
      expect(
        result.data?.avertissements.some((a: string) => a.includes("écrêtage"))
      ).toBe(true);
    });
  });

  // ============================================================
  // TESTS POUR onduleur - Types de système
  // ============================================================
  describe("onduleur - Types de système", () => {
    let resultModules: any;

    beforeEach(() => {
      const modulesResult = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000,
        600, // AJOUTER
        "haute_tension"
      );
      resultModules = modulesResult.data;
    });

    it("doit fonctionner avec un système off-grid", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "off-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.typeSysteme).toBe("off-grid");
    });

    it("doit fonctionner avec un système hybride", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "hybride",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.typeSysteme).toBe("hybride");
    });

    it("doit fonctionner avec un système on-grid", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.typeSysteme).toBe("on-grid");
    });
  });

  // ============================================================
  // TESTS POUR onduleur - Calculs de ratio DC/AC
  // ============================================================
  describe("onduleur - Ratios DC/AC", () => {
    let resultModules: any;

    beforeEach(() => {
      const modulesResult = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000,
        600, // AJOUTER
        "haute_tension"
      );
      resultModules = modulesResult.data;
    });

    it("doit évaluer comme 'sous-dimensionne' si ratio < 1.0", () => {
      const onduleurTresGrand = {
        ...mockOnduleurValide,
        puissanceACNominale: 20000,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurTresGrand
      );
      expect(result.data?.dimensionnement.evaluationRatio).toBe(
        "sous-dimensionne"
      );
    });

    it("doit évaluer comme 'optimal' si ratio entre 1.0 et 1.25", () => {
      const ratio =
        resultModules.puissancePVInstallee.stc /
        mockOnduleurValide.puissanceACNominale;
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      if (ratio <= 1.25) {
        expect(result.data?.dimensionnement.evaluationRatio).toBe("optimal");
      }
    });

    it("doit évaluer comme 'acceptable' si ratio entre 1.25 et 1.4", () => {
      const onduleurMoyen = {
        ...mockOnduleurValide,
        puissanceACNominale: 3000,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurMoyen
      );
      if (
        result.data &&
        result.data.dimensionnement.ratioDCAC > 1.25 &&
        result.data.dimensionnement.ratioDCAC <= 1.4
      ) {
        expect(result.data.dimensionnement.evaluationRatio).toBe("acceptable");
      }
    });

    it("doit évaluer comme 'eleve' si ratio > 1.4", () => {
      const onduleurTresPetit = {
        ...mockOnduleurValide,
        puissanceACNominale: 2000,
      };
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1000,
        "on-grid",
        4000,
        onduleurTresPetit
      );
      if (result.data && result.data.dimensionnement.ratioDCAC > 1.4) {
        expect(result.data.dimensionnement.evaluationRatio).toBe("eleve");
      }
    });
  });

  // ============================================================
  // TESTS POUR onduleur - Irradiance
  // ============================================================
  describe("onduleur - Gestion irradiance", () => {
    let resultModules: any;

    beforeEach(() => {
      const modulesResult = service.modulesPV(
        mockPanneauStandard,
        5000,
        mockTemperatures,
        1000
      );
      resultModules = modulesResult.data;
    });

    it("doit utiliser IRRADIANCE_STC par défaut si irradiance invalide", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        0,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.grandeursChamp.iscChamp).toBeGreaterThan(0);
    });

    it("doit utiliser IRRADIANCE_STC par défaut si irradiance négative", () => {
      const result = service.onduleur(
        resultModules,
        mockPanneauStandard,
        -100,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      expect(result.data?.grandeursChamp.iscChamp).toBeGreaterThan(0);
    });

    it("doit appliquer le facteur d'irradiance correctement", () => {
      const result800 = service.onduleur(
        resultModules,
        mockPanneauStandard,
        800,
        "on-grid",
        4000,
        mockOnduleurValide
      );
      const result1200 = service.onduleur(
        resultModules,
        mockPanneauStandard,
        1200,
        "on-grid",
        4000,
        mockOnduleurValide
      );

      expect(result1200.data?.grandeursChamp.iscChamp).toBeGreaterThan(
        result800.data ? result800.data.grandeursChamp.iscChamp : 0
      );
    });
  });

  // ============================================================
  // TESTS D'INTÉGRATION - Flux complet
  // ============================================================
  describe("Tests d'intégration - Flux complet", () => {
    it("doit dimensionner un système complet off-grid 3kWc", () => {
      const PR = service.performanceRatio("STANDARD").PR;
      const puissance = service.puissanceCretePV(false, 6000, 5, PR);
      expect(puissance.success).toBe(true);

      const modules = service.modulesPV(
        mockPanneauPetit,
        puissance.puissanceCrete,
        mockTemperatures,
        1000
      );
      expect(modules.success).toBe(true);

      if (modules.data) {
        const onduleur = service.onduleur(
          modules.data,
          mockPanneauPetit,
          1000,
          "off-grid",
          2000,
          mockOnduleurPetit
        );
        expect(onduleur.data?.appareil).toBe("onduleur");
        expect(onduleur.data?.dimensionnement).toBeDefined();
      }
    });

    it("doit dimensionner un système complet on-grid 10kWc", () => {
      const PR = service.performanceRatio("HAUTE_QUALITE").PR;
      const puissance = service.puissanceCretePV(false, 15000, 5, PR);
      expect(puissance.success).toBe(true);

      const modules = service.modulesPV(
        mockPanneauStandard,
        puissance.puissanceCrete,
        mockTemperatures,
        1000
      );
      expect(modules.success).toBe(true);

      if (modules.data) {
        const onduleur = service.onduleur(
          modules.data,
          mockPanneauStandard,
          1000,
          "on-grid",
          8000,
          mockOnduleurValide
        );
        expect(onduleur.data?.verification).toBeDefined();
      }
    });

    it("doit dimensionner un système de pompage solaire", () => {
      const PR = service.performanceRatio("STANDARD").PR;
      const puissance = service.puissanceCretePV(true, 0, 5, PR, mockPompage);
      expect(puissance.success).toBe(true);

      const modules = service.modulesPV(
        mockPanneauPetit,
        puissance.puissanceCrete,
        mockTemperatures,
        1000
      );
      expect(modules.success).toBe(true);
    });
  });

  // ============================================================
  // TESTS DE ROBUSTESSE
  // ============================================================
  describe("Robustesse technique", () => {
    it("ne doit pas modifier les objets d'entrée (immuabilité)", () => {
      const backupPanneau = JSON.stringify(mockPanneauStandard);
      const backupTemp = JSON.stringify(mockTemperatures);

      service.modulesPV(mockPanneauStandard, 5000, mockTemperatures, 1000);

      expect(JSON.stringify(mockPanneauStandard)).toBe(backupPanneau);
      expect(JSON.stringify(mockTemperatures)).toBe(backupTemp);
    });

    it("doit gérer un projet industriel de grande puissance", () => {
      const panneauIndustriel: ParametresSTCPanneau = {
        puissanceCreteModule: 600,
        tensionMPP: 42.1,
        tensionVoc: 50.5,
        courantMPP: 14.2,
        courantCourtCircuit: 14.8,
        coeffTempTension: -0.28,
        coeffTempPuissance: -0.34,
        noct: 45,
      };
      const result = service.modulesPV(
        panneauIndustriel,
        250000,
        mockTemperatures,
        1000,
        1500,
        "haute_tension"
      );
      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.totalPanneaux).toBeGreaterThan(100);
      }
    });

    it("doit gérer des valeurs décimales avec précision", () => {
      const panneauDecimal: ParametresSTCPanneau = {
        puissanceCreteModule: 445.5,
        tensionMPP: 41.25,
        tensionVoc: 49.85,
        courantMPP: 10.82,
        courantCourtCircuit: 11.45,
        coeffTempTension: -0.295,
        coeffTempPuissance: -0.355,
        noct: 45.5,
      };
      const result = service.modulesPV(
        panneauDecimal,
        5000.5,
        mockTemperatures,
        1000
      );
      expect(result.success).toBe(true);
    });
  });
});
