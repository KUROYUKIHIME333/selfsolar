import {
  TypeSystemePV,
  ConfigurationTension,
} from "../types/installationPhotovoltaique.types.js";
/**
 * Déterminer la tension minimisant les pertes P = RI² (J'en déduit que U = RI),
 * Si on augmente U, on diminue I pour la meme puissance,
 * mais il faut garder la praticité en tete
 * TODO: Je dois changer et pauffiner ceci après
 */
export const tensionSystemePV = (
  puissanceCretePV: number,
  typeSysteme: TypeSystemePV = "off-grid" // "off-grid" par défaut pour sécuriser le calcul
): {
  success: boolean;
  config: ConfigurationTension;
  tension: number;
  error?: string;
} => {
  if (typeof puissanceCretePV !== "number" || isNaN(puissanceCretePV)) {
    return {
      success: false,
      config: "indefini",
      tension: 0,
      error: "La puissance crête doit être un nombre valide.",
    };
  }

  if (puissanceCretePV <= 0) {
    return {
      success: false,
      config: "indefini",
      tension: 0,
      error: "La puissance crête ne peut être nulle (0W) ou inférieure à 0 W.",
    };
  }

  if (puissanceCretePV > 50000000) {
    // 50 MWc
    return {
      success: false,
      config: "indefini",
      tension: 0,
      error: "La puissance crête dépasse les limites de cet outil (50MWc).",
    };
  }

  let tensionSystem: number = 24;
  let configuration: ConfigurationTension = "basse_tension";

  if (typeSysteme === "off-grid" || typeSysteme === "hybride") {
    // Monde du stockage / Très Basse Tension (TBT) pour la sécurité, éviter les risque d'électrisation dangeureux et les standards batteries
    if (puissanceCretePV <= 800) {
      tensionSystem = 12; // Petits kits (éclairage, site isolé minimaliste)
      configuration = "basse_tension";
    } else if (puissanceCretePV > 800 && puissanceCretePV <= 2500) {
      tensionSystem = 24; // Standard petites habitations / pompage
      configuration = "basse_tension";
    } else {
      // Au-delà de 2500W en site isolé ou hybride résidentiel, le 48V est le standard.
      // Même pour 10 kWc ou 15 kWc, d'après ce que j'ai compris,
      // on multiplie souvent les onduleurs ou les régulateurs MPPT en parallèle
      // branchés sur un gros banc de batteries en 48V (ex: batteries Lithium LiFePO4).
      tensionSystem = 48;
      configuration = "basse_tension";
    }
  } else if (typeSysteme === "on-grid") {
    // Injection réseau directe (Onduleurs de chaîne sans contrainte de batterie basse tension)
    if (puissanceCretePV <= 3000) {
      // Petit résidentiel monophasé : les onduleurs string acceptent généralement jusqu'à 500V ou 600V max,
      // mais avec peu de panneaux, la tension optimale de fonctionnement (MPPT) tourne autour de 300V ou 360V.
      tensionSystem = 360;
      configuration = "basse_tension";
    } else if (puissanceCretePV > 3000 && puissanceCretePV <= 30000) {
      // Résidentiel supérieur / Petit tertiaire (Onduleurs triphasés standards)
      // La tension nominale de la chaîne de panneaux se situe idéalement autour de 600V DC.
      tensionSystem = 600;
      configuration = "haute_tension";
    } else if (puissanceCretePV > 30000 && puissanceCretePV <= 250000) {
      // Tertiaire et Industriel (C&I) : Standard des onduleurs de chaînes industriels (Max 1000V à vide).
      tensionSystem = 1000;
      configuration = "haute_tension";
    } else {
      // Grandes centrales d'injection (> 250 kWc) : Standard moderne à 1500V DC pour réduire le cuivre au maximum.
      tensionSystem = 1500;
      configuration = "haute_tension";
    }
  }

  return {
    success: true,
    config: configuration,
    tension: tensionSystem,
  };
};
