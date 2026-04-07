export class GenerateursService {
  puissanceCrete(Ec: number, HSP: number, k: number | null) {
    return Ec / (HSP * k);
  };
  
  tensionSysteme(Pc: number) {
    if (Pc >0 & Pc<500) return 12;
    if (Pc>500 & Pc<2000) return 24;
    if (Pc>2000 & Pc<10000) return 48;
    if (Pc>10000) return 96;
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
  
  determinerK(inGridNoBatteries: boolean){
    if(!inGridNoBatteries) return 0.75;
    if(inGridNoBatteries) return 0.65;
  };
}

export const generateursService = new GenerateursService();