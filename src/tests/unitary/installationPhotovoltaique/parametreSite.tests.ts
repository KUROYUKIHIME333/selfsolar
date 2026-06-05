import { ParametresSiteService } from "../../../services/installationPhotovoltaique/parametreSite.services.js";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { Localisation } from "../../../types/installationPhotovoltaique.types.js";

// --- CONFIGURATION CONSTANTE POUR MSW ---
const MOCK_PVGIS_BASE = "https://re.jrc.ec.europa.eu/api/v5.3";

// --- MOCK DES UTILS MÉTÉO ET CONSTANTES CLIMATIQUES ---
vi.mock("../../../utils/meteoDatasAndConstantes.utils.js", () => {
  return {
    PVGIS_BASE: "https://re.jrc.ec.europa.eu/api/v5.3",
    DEFAULT_TARGET_YEAR: 2040,
    // AJOUT ESSENTIEL : Fournir fetchJson pour que le service puisse exécuter ses requêtes via MSW
    fetchJson: async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    },
    daysInMonth: (month: number) => {
      if (month === 2) return 28;
      return 31;
    },
    climateFraction: (targetYear: number) => {
      const startYear = 2020;
      if (targetYear <= startYear) return 0;
      return (targetYear - startYear) / 30;
    },
    IPCC_DELTA: {
      dT: 1.5, // +1.5°C d'augmentation globale centrale
      dG: -0.02, // -2% d'irradiation globale
    },
  };
});

// --- MOCKS DES RÉPONSES API PVGIS ---
const mockMRcalcSuccess = {
  inputs: {
    plane: {
      "fixed(i_opt)": {
        slope: {
          value: 12,
        },
      },
    },
  },
  outputs: {
    monthly: [
      { month: 1, "H(i_opt)_m": 150000 }, // 150000 / 1000 / 31 = 4.8387 PSH
      { month: 2, "H(i_opt)_m": 120000 }, // 120000 / 1000 / 28 = 4.2857 PSH (Min - Défavorable)
      { month: 3, "H(i_opt)_m": 170000 }, // 170000 / 1000 / 31 = 5.4838 PSH (Max - Surfavorable)
    ],
  },
};

const mockTMYSuccess = {
  outputs: {
    tmy_hourly: [
      { T2m: 22.0, WS10m: 2.0 },
      { T2m: 18.5, WS10m: 4.5 },
      { T2m: 31.0, WS10m: 1.0 },
      { T2m: 25.0, WS10m: 2.5 },
    ],
  },
};

// Configuration des Handlers MSW
const handlers = [
  http.get(`${MOCK_PVGIS_BASE}/MRcalc`, ({ request }) => {
    const url = new URL(request.url);
    if (!url.searchParams.get("lat") || !url.searchParams.get("lon")) {
      return new HttpResponse(null, { status: 400 });
    }
    return HttpResponse.json(mockMRcalcSuccess);
  }),

  http.get(`${MOCK_PVGIS_BASE}/tmy`, ({ request }) => {
    const url = new URL(request.url);
    if (!url.searchParams.get("lat") || !url.searchParams.get("lon")) {
      return new HttpResponse(null, { status: 400 });
    }
    return HttpResponse.json(mockTMYSuccess);
  }),
];

const server = setupServer(...handlers);

describe("ParametresSiteService - Suite de Tests Complète", () => {
  const service = new ParametresSiteService();
  const locKinshasa: Localisation = { lat: -4.32, long: 15.31 };

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });
  afterAll(() => server.close());

  // ==========================================
  // SECTION 1: TESTS SUR ANGLE OPTIMAL (GUIDE)
  // ==========================================
  describe("angleOptimal (Règles métiers du guide)", () => {
    it("doit calculer les paramètres pour l'hémisphère Sud (Kinshasa < 15°)", () => {
      const res = service.angleOptimal(locKinshasa.lat);
      expect(res).toEqual({
        hemisphère: "S",
        orientation: "N",
        angle: 10,
      });
    });

    it("doit calculer les paramètres pour l'hémisphère Nord (< 15°)", () => {
      const res = service.angleOptimal(6.5);
      expect(res).toEqual({
        hemisphère: "N",
        orientation: "S",
        angle: 10,
      });
    });

    it("doit appliquer angle = latitude pour les zones tropicales entre 15° et 25°", () => {
      const resNord = service.angleOptimal(20.4);
      expect(resNord.angle).toBe(20);
      expect(resNord.orientation).toBe("S");

      const resSud = service.angleOptimal(-17.8);
      expect(resSud.angle).toBe(18);
      expect(resSud.orientation).toBe("N");
    });

    it("doit appliquer la formule mathématique pour les latitudes élevées (> 25°)", () => {
      const resUn = service.angleOptimal(45);
      expect(resUn.angle).toBe(37); // Math.round(45 * 0.76 + 3.1) = 37

      const resDeux = service.angleOptimal(-50);
      expect(resDeux.angle).toBe(41); // Math.round(50 * 0.76 + 3.1) = 41
    });
  });

  // ==========================================
  // SECTION 2: CAS NOMINAL ET CALCULS (PVGIS)
  // ==========================================
  describe("PVGISDatas - Cas Nominal & Success", () => {
    it("doit traiter correctement les PSH, Températures et Vents avec les calculs GIEC exactes", async () => {
      const res = await service.PVGISDatas(locKinshasa, 2026);

      expect(res.isFallback).toBe(false);
      expect(res.moisDefavorable).toBe("2");
      expect(res.moisSurfavorable).toBe("3");

      // Modifié avec toBeCloseTo pour éviter les faux négatifs dus à la précision des flottants (.toFixed(3))
      expect(res.PSH).toBeCloseTo(4.269, 3);
      expect(res.PSH_max).toBeCloseTo(5.462, 3);
      expect(res.angleOptimalPVGIS).toBe(12);

      // Validation des températures corrigées
      expect(res.T_min).toBe(18.8);
      expect(res.T_max).toBe(31.3);

      // Validation de l'analyse du Vent (Brut sans correction)
      expect(res.windSpeed_mean).toBe(2.5);
      expect(res.windSpeed_max).toBe(4.5);
    });

    it("doit inclure les métadonnées structurelles complètes de correction climatique du GIEC", async () => {
      const res = await service.PVGISDatas(locKinshasa, 2050);

      expect(res.climateCorrection).toBeDefined();
      expect(res.climateCorrection?.targetYear).toBe(2050);
      expect(res.climateCorrection?.dT).toBe(1.5); // fraction = 1 en 2050
      expect(res.climateCorrection?.dGPercent).toBe(-2);
    });
  });

  // ==========================================
  // SECTION 3: STRATÉGIE DE FALLBACK (ERREURS)
  // ==========================================
  describe("PVGISDatas - Gestion des Erreurs et Fallbacks", () => {
    it("doit basculer sur le Fallback équatorial si le serveur MRcalc échoue", async () => {
      server.use(
        http.get(`${MOCK_PVGIS_BASE}/MRcalc`, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const res = await service.PVGISDatas(locKinshasa); // lat = -4.32

      expect(res.isFallback).toBe(true);
      expect(res.PSH).toBe(4.5); // < 10° de latitude
      expect(res.T_min).toBe(15);
      expect(res.T_max).toBe(40);

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it("doit appliquer les bonnes PSH de repli selon les différents paliers de latitude", async () => {
      server.use(
        http.get(`${MOCK_PVGIS_BASE}/MRcalc`, () => {
          return new HttpResponse(null, { status: 502 });
        })
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      // Palier tropical : latAbs < 20 (ex: 15°)
      const resTropical = await service.PVGISDatas({ lat: 15, long: 10 });
      expect(resTropical.PSH).toBe(4.8);

      // Palier subtropical : latAbs < 35 (ex: 30°)
      const resSubtropical = await service.PVGISDatas({ lat: 30, long: 10 });
      expect(resSubtropical.PSH).toBe(4.0);

      // Palier tempéré : latAbs < 50 (ex: 45°)
      const resTempere = await service.PVGISDatas({ lat: 45, long: 10 });
      expect(resTempere.PSH).toBe(2.5);

      // Palier boréal/austral : latAbs >= 50 (ex: 60°)
      const resBoreal = await service.PVGISDatas({ lat: 60, long: 10 });
      expect(resBoreal.PSH).toBe(1.8);
    });

    it("doit lever une erreur et basculer en fallback si le format de réponse MRcalc est vide", async () => {
      server.use(
        http.get(`${MOCK_PVGIS_BASE}/MRcalc`, () => {
          return HttpResponse.json({ outputs: { monthly: [] } });
        })
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const res = await service.PVGISDatas(locKinshasa);
      expect(res.isFallback).toBe(true);
      expect(res.PSH).toBe(4.5);
    });

    it("doit basculer en fallback en cas de Timeout ou de crash réseau d'un des services", async () => {
      server.use(
        http.get(`${MOCK_PVGIS_BASE}/tmy`, () => {
          return HttpResponse.error(); // Simule une rupture réseau brute
        })
      );

      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const res = await service.PVGISDatas(locKinshasa);
      expect(res.isFallback).toBe(true);
      expect(res.PSH).toBe(4.5);
    });
  });
});
