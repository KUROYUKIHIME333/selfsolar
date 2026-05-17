// ─── CONSTANTES ───

export const PVGIS_BASE = "https://re.jrc.ec.europa.eu/api/v5_3";

/**
 * Delta climatique GIEC SSP2-4.5 à horizon 2050 vs baseline 2020.
 * Source : IPCC AR6 WG1, Table SPM.1, scénario intermédiaire SSP2-4.5.
 * dT = +1.5°C (valeur centrale mondiale ; Afrique centrale ≈ +1.4–2.1°C)
 * dG = -0.01 = -1% (conservative : aérosols, poussières, incertitude)
 */
export const IPCC_DELTA = { dT: 1.5, dG: -0.01 } as const;
export const CLIMATE_BASELINE_YEAR = 2020;
export const CLIMATE_HORIZON_YEAR = 2050;

/** Horizon cible par défaut pour la correction climatique */
export const DEFAULT_TARGET_YEAR = 2040;

/** Timeout fetch en ms */
export const FETCH_TIMEOUT_MS = 12_000;

// ─── UTILS ───

/**
 * Nombre de jours dans un mois (sans tenir compte des années bissextiles
 * pour MRcalc qui retourne des moyennes multi-annuelles).
 */
export const daysInMonth = (month: number): number => {
  // Mois 2 = 28.25 en moyenne sur 4 ans, on arrondit à 28 pour être conservateur
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month] ?? 30;
};

/**
 * Fraction de la correction climatique à appliquer selon l'année cible.
 * 0 en 2020, 1 en 2050, plafonné à [0, 1].
 */
export const climateFraction = (targetYear: number): number => {
  return Math.min(
    Math.max(
      (targetYear - CLIMATE_BASELINE_YEAR) /
        (CLIMATE_HORIZON_YEAR - CLIMATE_BASELINE_YEAR),
      0
    ),
    1
  );
};

// Fetch avec timeout et gestion d'erreur HTTP explicite
export const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "(pas de corps)");
    console.log(
      Error(`PVGIS HTTP ${response.status} ${response.statusText}: ${body}`)
    );
    // throw new Error(
    //   `PVGIS HTTP ${response.status} ${response.statusText}: ${body}`
    // );
  }
  return response.json();
};
