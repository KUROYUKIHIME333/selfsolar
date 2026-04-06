import { onduleurFacteur } from "../utils/facteursSecurite.js";

export class OnduleurService {
  caracteristiquesOnduleur(PuissanceCreteCharges: number, Usystem: number) {
    const PminOnduleur = onduleurFacteur * PuissanceCreteCharges;
    
    return {
      puissanceMin: PminOnduleur,
      tensionEntree: Usystem
    };
  }

  determinerTypeOnduleur(contientMoteurs: boolean, typeInstallation: string = "isole") {
    if (typeInstallation === "pompage") return "Variateur de fréquence (VFD)";
    if (typeInstallation === "reseau") return "Onduleur String (Injection)";
    
    return contientMoteurs ? "Pur Sinus" : "Pseudo-Sinus";
  }
}

export const onduleurService = new OnduleurService();