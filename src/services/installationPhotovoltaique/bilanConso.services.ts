import type { Equipement } from "../../types/installationPhotovoltaique.types.js";

// Service de calcul du bilan de consommation électrique
// Basé sur NFC 15-100 §771 - Méthode des coefficients de simultanéité

export class BilanConsommationService {
  /**
   * Calcule l'énergie journalière totale consommée
   * Formule: E_charge [Wh/j] = Σ (P_i × h_i)
   *
   * Note: Le facteur de simultanéité s'applique généralement à la puissance maximale
   * appelée pour l'onduleur, tandis que le facteur d'utilisation affecte l'énergie.
   */
  energieTotal(equipements: Equipement[]): number {
    if (!Array.isArray(equipements) || equipements.length === 0) {
      return 0;
    }
    const energiesEquipement = equipements.map(({ nom, P, h }) => ({
      equipement: nom || "Non nommé",
      energie: P * h,
    }));

    const total = energiesEquipement.reduce(
      (acc, { energie }) => acc + energie,
      0
    );

    // Arrondi propre à 2 décimales pour éviter les bizarreries de JavaScript (ex: 0.1 + 0.2, ceux qui savent vont comprendre)
    return Number(total.toFixed(2)); // en Wh/j
  }

  /**
   * Calcule la puissance appelée, en AC (charges simultanées)
   * Formule: P_crête = kf * Σ (P_i × h/24)
   * @param equipements Liste des équipements
   * @param kf Facteur de foisonnement global (0.6-1.0, défaut 0.8)
   * @returns Puissance appelée en W
   */
  puissanceAppelee(
    equipements: Equipement[],
    kf: number | null | undefined
  ): number {
    const P_crête_charge = equipements.reduce(
      (acc, { P, h }) => acc + P * (h / 24),
      0
    );

    // Facteur de foisonnement global selon NFC 15-100
    // Kf tient compte de la non-simultanéité entre usages différents
    const facteurFoisonnement = kf ?? 1; // Valeur standard résidentiel

    const P_appelée = P_crête_charge * facteurFoisonnement;

    return P_appelée; // en W
  }

  /**
   * Calcule la puissance totale installée, en AC (charges simultanées)
   * Formule: P_crête = Σ P_i
   * @param equipements Liste des équipements
   * @returns Puissance  totale installée en W
   */
  puissanceInstaleeAC(equipements: Equipement[]): number {
    const P_installee = equipements.reduce((acc, { P }) => acc + P, 0);
    return P_installee; // en W
  }

  /**
   * Calcule la puissance appelée aux pics ou pointes (démarages moteurs, etc.)
   * Formule: P_pic = Σ (P_i × k_pic)
   * @param equipements Liste des équipements
   * @param kf Facteur de foisonnement global (0.6-1.0, défaut 0.8)
   * @returns Puissance appelée aux pics en W
   */
  puissancePic(equipements: Equipement[]): number {
    const P_pic = equipements.reduce((acc, { P, k }) => acc + P * (k ?? 1), 0);

    return P_pic; // en W
  }
}

export const bilanConsommationService = new BilanConsommationService();
