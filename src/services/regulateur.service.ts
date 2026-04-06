import { regulateurFacteur } from "../utils/facteursSecurite.js";

export class RegulateurService {
  caracteristiquesRegulateur(Usystem: number, Iccpanneau: number, NstringPanneaux: number){
    const IccTotal = NstringPanneaux * Iccpanneau;
    const IminRegulateur = regulateurFacteur * IccTotal;
    
    return {
      courantMin: IminRegulateur,
      tensionFonctionnement: Usystem,
    };
  };
  
  typeRegulateur(puissanceInstallee: number, priorites: string[]){
    let type: string = "PWM";

    if (puissanceInstallee > 500 || priorites.includes("rendement") || priorites.includes("performance")) {
      type = "MPPT";
    }

    if (priorites.includes("economie") && puissanceInstallee <= 200) {
      type = "PWM";
    }

    return type;
  };
};

export const regulateurService = new RegulateurService();