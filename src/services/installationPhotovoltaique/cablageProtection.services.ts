import type {
  ResultatModulesPV,
  ParametresSTCPanneau,
  MateriauConducteur,
  DimensionnementAC,
  MethodePose,
  CalculSectionDCIntern,
  ResultatDimensionnementDC,
  ResultatSelectivite,
} from "../../types/installationPhotovoltaique.types.js";

// INTERFACES DE RETOUR ET TYPES INTERNES CONSERVÉS

import {
  SECTIONS_NORMALISEES,
  RESISTIVITE,
  COEFF_TEMP,
  COURANT_ADMISSIBLE_CUIVRE_B2,
  COURANT_ADMISSIBLE_ALU_B2,
  FACTEUR_TEMPERATURE_PVC,
  FACTEUR_GROUPEMENT,
} from "../../utils/constantesPhysiques.utils.js";

export class CablageEtProtectionsService {
  // DIMENSIONNEMENT CÂBLES DC (STRING & PRINCIPAL PV)

  public dimensionnerCablesDC(
    resultatModules: ResultatModulesPV,
    panneauParametres: ParametresSTCPanneau,
    longueurStringMeters: number = 15,
    longueurPrincipalMeters: number = 10,
    temperatureAmbiante: number = 30,
    materiau: MateriauConducteur = "cuivre"
  ): ResultatDimensionnementDC {
    const Isc_stc = panneauParametres.courantCourtCircuit;
    const Voc_stc = panneauParametres.tensionVoc;
    const nombreStrings = resultatModules.stringsEnParallele;

    if (!Isc_stc || Isc_stc <= 0)
      throw new Error("Isc_stc doit être supérieur à 0");
    if (!Voc_stc || Voc_stc <= 0)
      throw new Error("Voc_stc doit être supérieur à 0");
    if (!nombreStrings || nombreStrings <= 0)
      throw new Error("nombreStrings doit être au moins de 1");

    const Isc_max_string = Isc_stc * 1.25;
    const Isc_max_principal = Isc_stc * nombreStrings * 1.25;

    const k_temp = this.interpolerFacteurTemperature(temperatureAmbiante);
    const k_group_string = 1.0;
    const k_group_principal = this.obtenirFacteurGroupement(nombreStrings);

    const k_total_string = k_temp * k_group_string;
    const k_total_principal = k_temp * k_group_principal;

    const sectionString = this.calculerSectionCableDC(
      Isc_max_string,
      longueurStringMeters,
      Voc_stc,
      k_total_string,
      1.0,
      materiau
    );

    const sectionPrincipal = this.calculerSectionCableDC(
      Isc_max_principal,
      longueurPrincipalMeters,
      Voc_stc,
      k_total_principal,
      2.0,
      materiau
    );

    const protectionRequise = nombreStrings >= 3;
    let calibreFusibleRecommande = 0;

    if (protectionRequise) {
      const In_min = 1.4 * Isc_stc;
      calibreFusibleRecommande = Math.ceil(In_min);
    }

    return {
      cableString: {
        courantEmploi_Ib: Number(Isc_max_string.toFixed(2)),
        facteurCorrectionK: Number(k_total_string.toFixed(2)),
        sectionConseillee_mm2: sectionString.section,
        chuteTension_Pourcent: Number(sectionString.chutePourcent.toFixed(2)),
      },
      cablePrincipal: {
        courantEmploi_Ib: Number(Isc_max_principal.toFixed(2)),
        facteurCorrectionK: Number(k_total_principal.toFixed(2)),
        sectionConseillee_mm2: sectionPrincipal.section,
        chuteTension_Pourcent: Number(
          sectionPrincipal.chutePourcent.toFixed(2)
        ),
      },
      protections: {
        fusiblesStringsRequis: protectionRequise,
        calibreFusibleString_A: calibreFusibleRecommande,
      },
    };
  }

  // DIMENSIONNEMENT CÂBLES AC (ONDULEUR -> RÉSEAU)

  public dimensionnerCablageAC(
    puissanceNominaleOnduleurWh: number,
    tensionReseauV: number,
    isTriphase: boolean,
    longueurMeters: number,
    cosPhi: number = 0.8,
    temperatureAmbiante: number = 30,
    materiau: MateriauConducteur = "cuivre",
    methodePose: MethodePose = "conduit_encastre"
  ): DimensionnementAC {
    if (!puissanceNominaleOnduleurWh || puissanceNominaleOnduleurWh <= 0)
      throw new Error("puissanceNominaleOnduleurWh invalide");
    if (!tensionReseauV || tensionReseauV <= 0)
      throw new Error("tensionReseauV invalide");

    let Ib = 0;
    if (isTriphase) {
      Ib =
        puissanceNominaleOnduleurWh / (tensionReseauV * Math.sqrt(3) * cosPhi);
    } else {
      Ib = puissanceNominaleOnduleurWh / (tensionReseauV * cosPhi);
    }

    const In = Math.ceil(Ib * 1.1);

    const k_temp = this.interpolerFacteurTemperature(temperatureAmbiante);
    const k_total = k_temp * 1.0;
    const Iz_requis = In / k_total;

    const tableCourants =
      materiau === "cuivre"
        ? COURANT_ADMISSIBLE_CUIVRE_B2
        : COURANT_ADMISSIBLE_ALU_B2;

    const sectionMaximaleInitiale =
      SECTIONS_NORMALISEES[SECTIONS_NORMALISEES.length - 1];
    if (sectionMaximaleInitiale === undefined) {
      throw new Error("[CablageAC] Table des sections vides ou non définie.");
    }

    let sectionSelectionnee = sectionMaximaleInitiale;
    let sectionTrouvee = false;

    for (const section of SECTIONS_NORMALISEES) {
      const courantAdmissible = tableCourants[section];
      if (courantAdmissible !== undefined && courantAdmissible >= Iz_requis) {
        sectionSelectionnee = section;
        sectionTrouvee = true;
        break;
      }
    }

    if (!sectionTrouvee) {
      throw new Error(
        `[CablageAC] Intensité requise (${Iz_requis.toFixed(
          1
        )}A) hors limites des tables pour l'${
          materiau === "cuivre" ? "Cuivre" : "Aluminium"
        }.`
      );
    }

    const rho20 = RESISTIVITE[materiau];
    const alpha = COEFF_TEMP[materiau];
    const rho70 = rho20 * (1 + alpha * (70 - 20));

    let chuteTensionV = 0;
    let chutePourcent = 100;

    const sectionMaximaleAbsolue =
      SECTIONS_NORMALISEES[SECTIONS_NORMALISEES.length - 1] ??
      sectionSelectionnee;

    while (sectionSelectionnee <= sectionMaximaleAbsolue) {
      if (isTriphase) {
        chuteTensionV =
          Math.sqrt(3) *
          Ib *
          longueurMeters *
          (rho70 / sectionSelectionnee) *
          cosPhi;
      } else {
        chuteTensionV =
          2 * Ib * longueurMeters * (rho70 / sectionSelectionnee) * cosPhi;
      }
      chutePourcent = (chuteTensionV / tensionReseauV) * 100;

      if (chutePourcent <= 3.0) {
        break;
      }

      const indexActuel = SECTIONS_NORMALISEES.indexOf(sectionSelectionnee);
      const sectionSuivante = SECTIONS_NORMALISEES[indexActuel + 1];

      if (
        indexActuel < SECTIONS_NORMALISEES.length - 1 &&
        sectionSuivante !== undefined
      ) {
        sectionSelectionnee = sectionSuivante;
      } else {
        throw new Error(
          `[CablageAC] Chute de tension prohibitive (${chutePourcent.toFixed(
            1
          )}%) même avec la section maximale disponible.`
        );
      }
    }

    // Retour conforme à l'interface `DimensionnementAC` exigée
    return {
      section: sectionSelectionnee,
      materiau: materiau,
      courantEmploi: Number(Ib.toFixed(2)),
      courantAdmissible: Number((sectionSelectionnee * k_total).toFixed(2)), // Courant Iz théorique indicatif
      protection: In,
      chuteTension: Number(chutePourcent.toFixed(2)),
      chuteTensionMax: 3.0,
      ddr: {
        type: "B", // Type standard recommandé pour le photovoltaïque
        sensibilite: 300,
        norme: "NF C 15-100",
      },
      methodePose: methodePose,
      facteursCorrection: {
        kT: k_temp,
        total: k_total,
      },
    };
  }

  // VÉRIFICATION DE LA SÉLECTIVITÉ DES PROTECTIONS

  public verifierSelectivite(
    protectionAmont: { calibre: number; type: string; temporisation?: number },
    protectionAval: { calibre: number; type: string; temporisation?: number }
  ): ResultatSelectivite {
    const amontCalibre = protectionAmont?.calibre ?? 1;
    const avalCalibre = protectionAval?.calibre ?? 1;
    const avalCalibreSain = avalCalibre > 0 ? avalCalibre : 1;

    const ratioAmpere = amontCalibre / avalCalibreSain;
    const selectifAmpere = ratioAmpere >= 1.6;

    const tempAmont = protectionAmont?.temporisation || 0;
    const tempAval = protectionAval?.temporisation || 0;
    const selectifChrono = tempAmont > tempAval;

    const selectif = selectifAmpere || selectifChrono;

    const typeSelectivite: "ampèremétrique" | "chronométrique" | "aucune" =
      selectifChrono
        ? "chronométrique"
        : selectifAmpere
        ? "ampèremétrique"
        : "aucune";

    let commentaire =
      "Risque de déclenchement intempestif simultané (Ratio < 1.6)";
    if (selectifChrono) {
      commentaire = `Sélectivité chronométrique respectée (Amont ${tempAmont}ms > Aval ${tempAval}ms)`;
    } else if (selectifAmpere) {
      commentaire = "Sélectivité ampèremétrique respectée (Ratio >= 1.6)";
    }

    if (amontCalibre <= 0 || avalCalibre <= 0) {
      commentaire = "Calibres invalides";
    }

    return {
      selectif,
      typeSelectivite,
      ratio: Number((Math.round(ratioAmpere * 100) / 100).toFixed(2)),
      commentaire,
    };
  }

  // ENTRAILLES ET MÉTHODES PRIVÉES DE CALCULS TECHNIQUES

  private calculerSectionCableDC(
    courant: number,
    longueur: number,
    tensionSysteme: number,
    k_total: number,
    chuteTensionMaxPourcent: number,
    materiau: MateriauConducteur
  ): CalculSectionDCIntern {
    const tableCourants =
      materiau === "cuivre"
        ? COURANT_ADMISSIBLE_CUIVRE_B2
        : COURANT_ADMISSIBLE_ALU_B2;
    const rho20 = RESISTIVITE[materiau];

    let sectionRetenue = 0;
    let chutePourcentFinale = 100;
    let diagnosticErreur = "Aucune section ne répond aux critères.";

    for (const section of SECTIONS_NORMALISEES) {
      const Iz_courant_nu = tableCourants[section];

      if (Iz_courant_nu === undefined) {
        continue;
      }

      const Iz_corrige = Iz_courant_nu * k_total;

      if (Iz_corrige < courant) {
        diagnosticErreur = `Courant admissible Iz corrigé insuffisant (${Iz_corrige.toFixed(
          1
        )}A requis pour ${courant}A).`;
        continue;
      }

      const chuteTensionV = (2 * longueur * courant * rho20) / section;
      const chutePourcent = (chuteTensionV / tensionSysteme) * 100;

      if (chutePourcent <= chuteTensionMaxPourcent) {
        sectionRetenue = section;
        chutePourcentFinale = chutePourcent;
        break;
      } else {
        diagnosticErreur = `Chute de tension hors limites (${chutePourcent.toFixed(
          2
        )}% mesurée, max toléré: ${chuteTensionMaxPourcent}%).`;
      }
    }

    if (sectionRetenue === 0) {
      throw new Error(
        `[CablageDC - Échec] Impossible de dimensionner le câble (${materiau}) pour ${longueur}m / ${courant}A. Raison : ${diagnosticErreur}`
      );
    }

    return { section: sectionRetenue, chutePourcent: chutePourcentFinale };
  }

  private interpolerFacteurTemperature(temp: number): number {
    const minFacteur = FACTEUR_TEMPERATURE_PVC[10];
    const maxFacteur = FACTEUR_TEMPERATURE_PVC[60];

    if (minFacteur === undefined || maxFacteur === undefined) {
      return 0.71;
    }

    if (temp <= 10) return minFacteur;
    if (temp >= 60) return maxFacteur;

    const cleArrondie = Math.round(temp / 5) * 5;
    return FACTEUR_TEMPERATURE_PVC[cleArrondie] ?? 0.71;
  }

  private obtenirFacteurGroupement(nombreCircuits: number): number {
    const premierFacteur = FACTEUR_GROUPEMENT[0];
    const dernierFacteur = FACTEUR_GROUPEMENT[8];

    if (premierFacteur === undefined || dernierFacteur === undefined) {
      return 1.0;
    }

    if (nombreCircuits <= 1) return premierFacteur;
    if (nombreCircuits >= 9) return dernierFacteur;

    return FACTEUR_GROUPEMENT[nombreCircuits - 1] ?? 1.0;
  }
}

export const cablageEtProtectionsService = new CablageEtProtectionsService();
