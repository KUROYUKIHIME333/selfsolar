export class BatteriesService {
  capaciteTotale(Usystem: number, autonomie: number, DoD: number, Ec: number): number {
    if (!Usystem || Usystem === 0 || !DoD || DoD === 0) return 0;
    const C = (Ec * autonomie) / (Usystem * DoD);
    return Math.ceil(C);
  }
  
  batteriesSerie(Usystem: number, Ubatterie: number): number {
    if (!Ubatterie || Ubatterie === 0) return 0;
    return Math.ceil(Usystem / Ubatterie);
  }
  
  batteriesParallele(Nserie: number, Nbatt: number): number {
    if (!Nserie || Nserie === 0) return 0;
    return Math.ceil(Nbatt / Nserie);
  }
  
  batteriesTotal(Csystem: number, Cbatterie: number): number {
    if (!Cbatterie || Cbatterie === 0) return 0;
    return Math.ceil(Csystem / Cbatterie);
  }
  
  determinerDoD(typeBatterie: string | null): number | null {
    if (!typeBatterie) return null;
    const type = typeBatterie.toLowerCase();
    if (type === "plomb") return 0.5;
    if (type === "lithium") return 0.8;
    return 0.6; // Valeur par défaut prudente
  }
}

export const batteriesService = new BatteriesService();