import { 
  disjoncteurPvRegulateurFacteur, 
  disjoncteurStringFacteur, 
  protectionBatterieFacteur 
} from "../utils/facteursSecurite.js";
import { protectionReturn } from "../utils/protectionReturnFormat.js";

export class ProtectionsService {
  // Protection générale entre le coffret de regroupement et le régulateur
  disjoncteurPvRegulateur(Icctotal: number) {
    const Iccdisjoncteur = disjoncteurPvRegulateurFacteur * Icctotal;
    return protectionReturn("disjoncteur ou fusible", "DC", Iccdisjoncteur, "Entre champs PV et regulateur");
  }

  // Protection individuelle pour chaque chaîne (string) de panneaux
  protectionString(Iccpanneau: number) {
    const Ifusible = disjoncteurStringFacteur * Iccpanneau;
    return protectionReturn("fusible gPV", "DC", Ifusible, "Protection individuelle de chaque string PV");
  }

  // Protection entre les batteries et l'onduleur (Imax absorbé par l'onduleur)
  disjoncteurBattOnduleur(ImaxOnduleur: number) {
    const Iprotection = protectionBatterieFacteur * ImaxOnduleur;
    return protectionReturn("disjoncteur ou fusible", "DC", Iprotection, "Entre les batteries et l'onduleur");
  }

  // Sectionneur fusible spécifique pour le parc batterie
  sectionneurBatterie(CapaciteBatterieAh: number) {
    // Calibre conventionnel : courant de décharge max ≈ C/1 (capacité en Ah)
    const calibre = CapaciteBatterieAh > 0 ? CapaciteBatterieAh : 0;
    return protectionReturn("sectionneur à couteaux (NH)", "DC", calibre, "Coupure générale et isolation du parc batterie");
  }
}

export const protectionsService = new ProtectionsService();