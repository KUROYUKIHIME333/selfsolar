import type { Equipement } from "../../types/installationPhotovoltaique.types.js";

export class BilanConsommationService {
    energieTotal(equipements: Equipement[]) {
        const energiesEquipement = equipements.map(({ nom, P, h, ks }) => ({
            equipement: nom,
            energie: P * h * ks
        }));

        const total = energiesEquipement.reduce((acc, { energie }) => acc + energie, 0);

        return (total); // en Wh/j
    };

    puissanceTotal(equipements: Equipement[], kf: number | null | undefined) {
        const P_crête_charge = equipements.reduce((acc, { P, ks }) => acc + (P * ks), 0);
        const P_appelée = kf ?
            P_crête_charge * kf
            : P_crête_charge;

        return P_appelée // en W
    }
};

export const bilanConsommationService = new BilanConsommationService();