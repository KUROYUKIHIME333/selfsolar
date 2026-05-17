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

// Définition d'un type pour la réponse PVGIS pour le mock
interface PVGISMonthlyResponse {
  outputs: {
    monthly: Array<{
      month: number;
      H_h: number;
      [key: string]: any; // Pour les autres champs comme l'angle
    }>;
  };
}

const handlers = [
  http.get("https://re.jrc.ec.europa.eu/api/v5.2/MRcalc", ({ request }) => {
    const url = new URL(request.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");

    // Vérification que les paramètres sont bien transmis
    if (!lat || !lon) {
      return new HttpResponse(null, { status: 400 });
    }

    const mockData: PVGISMonthlyResponse = {
      outputs: {
        monthly: [
          { month: 1, H_h: 6.5, angle: 10 }, // Max (Surfavorable)
          { month: 7, H_h: 3.8, angle: 12 }, // Min (Défavorable)
        ],
      },
    };

    return HttpResponse.json(mockData);
  }),
];

const server = setupServer(...handlers);

describe("ParametresSiteService TS-Proof", () => {
  const service = new ParametresSiteService();
  const locKinshasa: Localisation = { lat: -4.32, long: 15.31 };

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe("angleOptimal", () => {
    it("doit calculer les paramètres pour Kinshasa", () => {
      const res = service.angleOptimal(locKinshasa.lat);
      expect(res).toEqual({
        hemisphère: "S",
        orientation: "N",
        angle: 10,
      });
    });

    it("doit calculer les paramètres pour une latitude élevée (>25)", () => {
      const res = service.angleOptimal(45);
      // 45 * 0.76 + 3.1 = 37.3 -> 37
      expect(res.angle).toBe(37);
    });
  });

  describe("PVGISDatas", () => {
    it("doit respecter strictement le format de retour en cas de succès", async () => {
      const res = await service.PVGISDatas(locKinshasa);

      // Vérification des types et valeurs attendues
      expect(res.G_moy).toBe(3.8);
      expect(res.G_max).toBe(6.5);
      expect(res.PSH).toBe(3.8);
      expect(res.PSH_max).toBe(6.5);
      expect(res.moisDefavorable).toBe("7");
      expect(res.moisSurfavorable).toBe("1");
      expect(typeof res.angleOptimalPVGIS).toBe("number");
    });

    it("doit utiliser le fallback correct en cas d'erreur serveur", async () => {
      server.use(
        http.get("https://re.jrc.ec.europa.eu/api/v5.2/MRcalc", () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      // On mock console pour éviter de polluer le terminal de test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const res = await service.PVGISDatas(locKinshasa);

      expect(res.G_moy).toBe(4.5); // Fallback pour absLat < 20
      expect(res.PSH).toBe(4.5);
      expect(res.G_max).toBe(4.5);
      expect(res.PSH_max).toBe(4.5);

      consoleSpy.mockRestore();
    });

    it("doit gérer les timeouts via AbortSignal", async () => {
      // On simule une requête qui ne répond jamais pour déclencher le timeout
      server.use(
        http.get("https://re.jrc.ec.europa.eu/api/v5.2/MRcalc", async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return HttpResponse.json({});
        })
      );

      // On réduit le timeout dans le code ou on teste la gestion d'erreur du fetch
      // Ici, le catch du service retournera le fallback.
      const res = await service.PVGISDatas({ lat: 30, long: 31 });
      expect(res.PSH).toBe(4.0); // Fallback pour 20 < lat < 35
    });
  });
});
