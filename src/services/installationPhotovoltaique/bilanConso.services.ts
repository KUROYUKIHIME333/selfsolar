import type { Equipement } from "../../types/installationPhotovoltaique.types.js";

// Service de calcul du bilan de consommation électrique
// Basé sur NFC 15-100 - Méthode des coefficients de simultanéité et d'appel

const validationEquipements = (equipements: Equipement[]) => {
  if (!Array.isArray(equipements)) {
    throw new Error("Liste des equipements invalide");
  }
  if (equipements.length === 0) {
    throw new Error("Liste des equipements vide");
  }
};
export class BilanConsommationService {
  /**
   * Calcule l'énergie journalière totale consommée
   * Formule: E_charge [Wh/j] = Σ (P_i × h_i)
   */
  energieTotal(equipements: Equipement[]): number {
    validationEquipements(equipements);

    const total = equipements.reduce((acc, eq) => {
      const puissance = typeof eq.P === "number" && eq.P > 0 ? eq.P : 0;
      const heures = typeof eq.h === "number" && eq.h > 0 ? eq.h : 0;

      return acc + puissance * heures;
    }, 0);

    // Arrondi propre à 2 décimales pour éviter les résidus flottants binaires de JavaScript
    return Number(total.toFixed(2)); // en Wh/j
  }

  /**
   * Calcule la puissance appelée maximale simultanée en AC
   * Formule: P_appelee = kf * Σ P_i
   * @param equipements Liste des équipements
   * @param kf Facteur de foisonnement global (0.6-1.0, défaut 0.8 selon NFC 15-100)
   * @returns Puissance appelée en W
   */
  puissanceAppelee(
    equipements: Equipement[],
    kf: number | null | undefined
  ): number {
    validationEquipements(equipements);

    const P_crete_charge = equipements.reduce((acc, eq) => {
      const puissance = typeof eq.P === "number" && eq.P > 0 ? eq.P : 0;
      return acc + puissance;
    }, 0);

    // Kf tient compte de la non-simultanéité entre usages différents
    const facteurFoisonnement =
      typeof kf === "number" && kf > 0 && kf <= 1 ? kf : 1;

    const P_appelee = P_crete_charge * facteurFoisonnement;

    return Number(P_appelee.toFixed(2)); // en W
  }

  /**
   * Calcule la puissance totale installée en AC (sans aucun coefficient)
   * Formule: P_installee = Σ P_i
   * @param equipements Liste des équipements
   * @returns Puissance totale installée en W
   */
  puissanceInstaleeAC(equipements: Equipement[]): number {
    validationEquipements(equipements);

    const P_installee = equipements.reduce((acc, eq) => {
      const puissance = typeof eq.P === "number" && eq.P > 0 ? eq.P : 0;
      return acc + puissance;
    }, 0);

    return Number(P_installee.toFixed(2)); // en W
  }

  /**
   * Calcule la puissance de crête absolue lors du démarrage simultané des équipements
   * Formule: P_pic = Σ (P_i × k_i)
   * @param equipements Liste des équipements avec leur facteur de démarrage individuel k
   * @returns Puissance de pointe maximale en W (dimensionnement transitoire de l'onduleur)
   */
  puissancePic(equipements: Equipement[]): number {
    validationEquipements(equipements);

    const P_pic = equipements.reduce((acc, eq) => {
      const puissance = typeof eq.P === "number" && eq.P > 0 ? eq.P : 0;
      // Si k n'est pas défini ou invalide, le coefficient d'appel par défaut est 1 (charge résistive pure)
      const coefficientAppel = typeof eq.k === "number" && eq.k >= 1 ? eq.k : 1;

      return acc + puissance * coefficientAppel;
    }, 0);

    return Number(P_pic.toFixed(2)); // en W
  }
}

export const bilanConsommationService = new BilanConsommationService();
