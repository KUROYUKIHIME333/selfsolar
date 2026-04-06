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
    // On dimensionne souvent selon le courant de décharge max ou la capacité
    // Ici basé sur le calibre de sécurité standard
    return protectionReturn("sectionneur à couteaux (NH)", "DC", null, "Coupure générale et isolation du parc batterie");
  }
}

export const protectionsService = new ProtectionsService();