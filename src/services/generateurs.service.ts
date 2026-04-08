export class GenerateursService {
  puissanceCrete(Ec: number, HSP: number, k: number): number {
    return Ec / (HSP * k);
  };
  
  tensionSysteme(Pc: number): number {
    if (Pc > 0    && Pc <= 500)   return 12;
    if (Pc > 500  && Pc <= 2000)  return 24;
    if (Pc > 2000 && Pc <= 10000) return 48;
    if (Pc > 10000)               return 96;
    return 12; // fallback : Pc = 0 ou valeur hors plage
  };
  
  panneauxSerie(Usystem: number, Upanneau: number) {
    const Nserie = Usystem/Upanneau;
    return Nserie;
  };
  
  panneauTotal(PcSystem: number, PcPanneau: number) {
    return (PcSystem / PcPanneau);
  };
  
  panneauxParallele(Nserie:number, N: number) {
    const Nparallele = N / Nserie;
    return Nparallele;
  };
  
  determinerK(inGridNoBatteries: boolean): number {
    return inGridNoBatteries ? 0.65 : 0.75;
  };
}

export const generateursService = new GenerateursService();