import type { Equipement } from "../../types/installationPhotovoltaique.types.js";

// Service de calcul du bilan de consommation électrique
// Basé sur NFC 15-100 §771 - Méthode des coefficients de simultanéité

export class BilanConsommationService {

    /**
     * Calcule l'énergie journalière totale consommée
     * Formule: E_charge [Wh/j] = Σ (P_i × h_i × ks_i)
     * @param equipements Liste des équipements avec puissance, durée, facteur simultanéité
     * @returns Énergie totale en Wh/jour
     */
    energieTotal(equipements: Equipement[]): number {
        const energiesEquipement = equipements.map(({ nom, P, h, ks }) => ({
            equipement: nom || "Non nommé",
            energie: P * h * ks
        }));

        const total = energiesEquipement.reduce((acc, { energie }) => acc + energie, 0);

        return total; // en Wh/j
    }

    /**
     * Calcule la puissance de crête apparente (charges simultanées)
     * Formule: P_crête = Σ (P_i × ks_i) × Kf (facteur de foisonnement global)
     * @param equipements Liste des équipements
     * @param kf Facteur de foisonnement global (0.6-1.0, défaut 0.8)
     * @returns Puissance apparente en W
     */
    puissanceTotal(equipements: Equipement[], kf: number | null | undefined): number {
        const P_crête_charge = equipements.reduce((acc, { P, ks }) => acc + (P * ks), 0);

        // Facteur de foisonnement global selon NFC 15-100
        // Kf tient compte de la non-simultanéité entre usages différents
        const facteurFoisonnement = kf ?? 0.8; // Valeur standard résidentiel

        const P_appelée = P_crête_charge * facteurFoisonnement;

        return P_appelée; // en W
    }
}

export const bilanConsommationService = new BilanConsommationService();