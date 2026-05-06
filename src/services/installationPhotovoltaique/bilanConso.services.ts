import type { Equipement } from "../../types/installationPhotovoltaique.types.js";

// Service de calcul du bilan de consommation électrique
// Basé sur NFC 15-100 §771 - Méthode des coefficients de simultanéité

export class BilanConsommationService {
  /**
   * Calcule l'énergie journalière totale consommée
   * Formule: E_charge [Wh/j] = Σ (P_i × h_i)
   * @param equipements Liste des équipements avec puissance, durée, facteur simultanéité
   * @returns Énergie totale en Wh/jour
   */
  energieTotal(equipements: Equipement[]): number {
    const energiesEquipement = equipements.map(({ nom, P, h }) => ({
      equipement: nom || "Non nommé",
      energie: P * h,
    }));

    const total = energiesEquipement.reduce(
      (acc, { energie }) => acc + energie,
      0
    );

    return total; // en Wh/j
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
    const facteurFoisonnement = kf ?? 0.8; // Valeur standard résidentiel

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
