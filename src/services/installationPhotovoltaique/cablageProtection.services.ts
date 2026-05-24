import type {
  ParametresSTCPanneau,
  ResultatModulesPV,
  MateriauConducteur,
  MethodePose,
  ConditionEnvironnement,
  TypeCableSolaire,
  CableDCDimensionnement,
  ProtectionDC,
  DimensionnementAC,
  ResultatDimensionnementCablage,
} from "../../types/installationPhotovoltaique.types.js";
import {
  RESISTIVITE,
  COEFF_TEMP,
  TEMP_MAX_CONDUCTEUR,
  SECTIONS_NORMALISEES,
  COURANT_ADMISSIBLE_CUIVRE_B2,
  FACTEUR_ALUMINIUM,
  FACTEUR_TEMPERATURE_PVC,
  FACTEUR_POSE,
  FACTEUR_GROUPEMENT,
  CALIBRES_FUSIBLES_DC,
  CALIBRES_DISJONCTEURS,
} from "../../utils/constantesPhysiques.utils.js";

export class CablageEtProtectionsService {
  // Dimensionnement complet du câblage DC et des protections associées
  dimensionnerCablesDC(
    resultatModules: ResultatModulesPV,
    panneauParametres: ParametresSTCPanneau,
    longueurString: number = 15,
    longueurPrincipal: number = 10,
    temperatureAmbiante: number = 40,
    nombreStrings: number = 1,
    materiau: MateriauConducteur = "cuivre",
    methodePose: MethodePose = "conduit_surface",
    conditionEnvironnement: ConditionEnvironnement = "chaud"
  ): ResultatDimensionnementCablage {
    // Sécurité contre les objets racine optionnels ou mal formés
    const params = panneauParametres || {};
    const Isc = params.courantCourtCircuit ?? 0;
    const Vmpp = params.tensionMPP ?? 0;
    const tensionVoc = params.tensionVoc ?? 0;

    const modules = resultatModules || {};
    const tensionStringSTC = modules.tensionStringSTC ?? 0;
    const vocStringFroid = modules.vocStringFroid ?? 0;

    const avertissements: string[] = [];
    const sectionsUtilisees: number[] = [];

    // Ajustement température selon environnement
    let tempAmbianteEffective = temperatureAmbiante;
    const tempMaxConducteur =
      TEMP_MAX_CONDUCTEUR && TEMP_MAX_CONDUCTEUR["H1Z2Z2-K"]
        ? TEMP_MAX_CONDUCTEUR["H1Z2Z2-K"]
        : 90;

    if (
      conditionEnvironnement === "extreme" ||
      conditionEnvironnement === "tres_chaud"
    ) {
      tempAmbianteEffective = Math.max(temperatureAmbiante, 50);
      avertissements.push(
        `Condition extrême: température ambiante ${tempAmbianteEffective}°C - Dé-rating strict appliqué`
      );
    }

    // Un câble PV au soleil monte facilement à TempAmbiante + 30°C
    const tempConducteurCalculee = Math.min(
      tempAmbianteEffective + 30,
      tempMaxConducteur
    );

    // RÈGLE UTE C15-712-1 : Courant de dimensionnement par string = Isc * 1.25
    const courantDimensionnementString = Isc * 1.25;

    // Câble par string
    const cableString = this.calculerSectionCableDC(
      longueurString,
      courantDimensionnementString,
      Vmpp,
      1.0,
      tempAmbianteEffective,
      tempConducteurCalculee,
      materiau,
      methodePose,
      1,
      "H1Z2Z2-K"
    );
    sectionsUtilisees.push(cableString.section);

    // Courant principal = Nombre de strings * Isc * 1.25
    const nStrings = nombreStrings > 0 ? nombreStrings : 1;
    const courantTotalDC = nStrings * courantDimensionnementString;
    const tensionSystemeDC = tensionStringSTC;
    const chuteTensionMaxPrincipal = 2.0;

    const cablePrincipal = this.calculerSectionCableDC(
      longueurPrincipal,
      courantTotalDC,
      tensionSystemeDC,
      chuteTensionMaxPrincipal,
      tempAmbianteEffective,
      tempConducteurCalculee,
      materiau,
      methodePose,
      nStrings > 1 ? Math.min(nStrings, 6) : 1,
      "H1Z2Z2-K"
    );
    sectionsUtilisees.push(cablePrincipal.section);

    const protectionsString: ProtectionDC[] = [];

    if (nStrings > 2) {
      const InMin = Isc * 1.4;
      const InMax = Isc * 2.0;
      const calibreFusible = this.calibrerFusibleDC(InMin, InMax);

      protectionsString.push({
        type: "fusible",
        calibre: calibreFusible,
        tensionAssignee: Math.ceil(vocStringFroid * 1.2),
        pouvoirCoupure: 10,
        norme: "IEC 60269-6",
        emplacement: `Boîte de jonction DC - protection individuelle des ${nStrings} strings`,
        caracteristiques: `gPV - Fusible spécial PV ${calibreFusible}A`,
      });
    }

    const protectionOnduleurDC: ProtectionDC[] = [];

    protectionOnduleurDC.push({
      type: "sectionneur",
      tensionAssignee: Math.ceil(vocStringFroid * 1.2),
      norme: "IEC 60947-3",
      emplacement: "Entrée onduleur DC - Coupure d'urgence/maintenance",
      caracteristiques: `Un ≥ ${Math.ceil(
        vocStringFroid * 1.2
      )}V, In ≥ ${Math.ceil(courantTotalDC)}A`,
    });

    if (courantTotalDC > 50) {
      const calibreDisjoncteur = this.calibrerDisjoncteur(
        courantTotalDC,
        Infinity
      );
      protectionOnduleurDC.push({
        type: "disjoncteur",
        calibre: calibreDisjoncteur,
        tensionAssignee: Math.ceil(vocStringFroid * 1.2),
        pouvoirCoupure: 6,
        norme: "IEC 60947-2",
        emplacement: "Coupure générale DC",
        caracteristiques: `Spécial DC, Magnétothermique courbe PV, ${calibreDisjoncteur}A`,
      });
    }

    const typeParafoudre =
      longueurString > 10 || conditionEnvironnement === "extreme"
        ? "Type 1+2 (Iimp 12.5kA)"
        : "Type 2 (In 20kA, Imax 40kA)";

    const parafoudreDC: ProtectionDC = {
      type: "parafoudre",
      tensionAssignee: Math.ceil(vocStringFroid * 1.2),
      norme: "IEC 61643-31",
      emplacement:
        longueurString > 10
          ? "Boîte de jonction ET Entrée Onduleur"
          : "Entrée Onduleur DC",
      caracteristiques: `${typeParafoudre} - Up ≤ 2.5kV, Uc ≥ ${Math.ceil(
        vocStringFroid * 1.2
      )}V`,
    };

    const chuteTensionGlobale =
      cableString.chuteTensionPourcent + cablePrincipal.chuteTensionPourcent;
    const verificationChuteTension = chuteTensionGlobale <= 3.0;

    if (!verificationChuteTension) {
      avertissements.push(
        `Chute de tension globale DC trop élevée: ${chuteTensionGlobale.toFixed(
          2
        )}% (Maximum recommandé: 3%)`
      );
    }

    if (materiau === "aluminium") {
      avertissements.push(
        `Aluminium détecté en DC: Assurer l'utilisation d'embouts bimétalliques pour éviter la corrosion galvanique.`
      );
    }

    return {
      panneauVoc: tensionVoc,
      cablesString: Array(nStrings).fill(cableString),
      cablePrincipalDC: cablePrincipal,
      protectionsString,
      protectionOnduleurDC,
      parafoudreDC,
      sectionsStandardUtilisees: [...new Set(sectionsUtilisees)],
      verificationChuteTensionGlobale: verificationChuteTension,
      avertissements,
    };
  }

  private calculerSectionCableDC(
    longueur: number,
    courant: number,
    tension: number,
    chuteTensionMax: number,
    temperatureAmbiante: number,
    temperatureConducteur: number,
    materiau: MateriauConducteur,
    methodePose: MethodePose,
    nombreCircuitsGroupe: number,
    typeCable: TypeCableSolaire
  ): CableDCDimensionnement {
    // Fallbacks stricts si les dictionnaires globaux ou les clés n'existent pas
    const rho20 =
      RESISTIVITE && RESISTIVITE[materiau] ? RESISTIVITE[materiau] : 0.0178;
    const alpha =
      COEFF_TEMP && COEFF_TEMP[materiau] ? COEFF_TEMP[materiau] : 0.0039;
    const rho = rho20 * (1 + alpha * (temperatureConducteur - 20));

    const kT = this.interpolerFacteurTemperature(temperatureAmbiante) ?? 0.9;
    const kP =
      FACTEUR_POSE && FACTEUR_POSE[methodePose]
        ? FACTEUR_POSE[methodePose]
        : 1.0;

    const indexGroupement = Math.min(nombreCircuitsGroupe, 6);
    const kG =
      FACTEUR_GROUPEMENT && FACTEUR_GROUPEMENT[indexGroupement]
        ? FACTEUR_GROUPEMENT[indexGroupement]
        : 1.0;

    const kM = materiau === "aluminium" ? FACTEUR_ALUMINIUM ?? 0.62 : 1.0;
    const kTotal = kT * kP * kG * kM;

    // Évite une division par zéro si la tension est nulle
    const tensionValide = tension > 0 ? tension : 1;
    const sections = SECTIONS_NORMALISEES || [1.5, 2.5, 4, 6, 10, 16, 25];

    for (const section of sections) {
      const I0 =
        COURANT_ADMISSIBLE_CUIVRE_B2 && COURANT_ADMISSIBLE_CUIVRE_B2[section]
          ? COURANT_ADMISSIBLE_CUIVRE_B2[section]
          : 0;
      const Iz = I0 * kTotal;

      if (Iz < courant) continue;

      const chuteTensionV = (2 * longueur * courant * rho) / section;
      const chuteTensionPourcent = (chuteTensionV / tensionValide) * 100;

      if (chuteTensionPourcent <= chuteTensionMax) {
        const resistanceLineique = (rho * 1000) / section;

        return {
          section,
          materiau,
          typeCable,
          courantAdmissible: Math.round(Iz * 100) / 100,
          courantDimensionnement: Math.round(courant * 100) / 100,
          resistanceLineique: Math.round(resistanceLineique * 1000) / 1000,
          chuteTensionV: Math.round(chuteTensionV * 100) / 100,
          chuteTensionPourcent: Math.round(chuteTensionPourcent * 100) / 100,
          chuteTensionMax,
          longueur,
          nombreConducteurs: 2,
          temperatureAmbiante,
          temperatureConducteur,
          methodePose,
          facteursCorrection: {
            kT: Math.round(kT * 100) / 100,
            kG: Math.round(kG * 100) / 100,
            kP: Math.round(kP * 100) / 100,
            kM: Math.round(kM * 100) / 100,
            total: Math.round(kTotal * 100) / 100,
          },
        };
      }
    }

    throw new Error(
      `Impossible de dimensionner le câble DC: Chute de tension ou courant admissible hors limites.`
    );
  }

  dimensionnerCablageAC(
    puissanceAC: number,
    tensionAC: number = 230,
    cosPhi: number = 0.95,
    longueur: number = 20,
    typeCharge: "eclairage" | "force" | "mixte" = "mixte",
    temperatureAmbiante: number = 30,
    methodePose: MethodePose = "conduit_encastre",
    materiau: MateriauConducteur = "cuivre"
  ): DimensionnementAC {
    const estTriphase = tensionAC >= 400;
    const cosPhiSain = cosPhi > 0 ? cosPhi : 0.95;
    const tensionSaine = tensionAC > 0 ? tensionAC : 230;

    // Calcul du courant d'emploi (Ib) sécurisé contre les divisions par 0
    const Ib = estTriphase
      ? puissanceAC / (Math.sqrt(3) * tensionSaine * cosPhiSain)
      : puissanceAC / (tensionSaine * cosPhiSain);

    const deltaUmax = typeCharge === "eclairage" ? 3.0 : 5.0;

    const kT = this.interpolerFacteurTemperature(temperatureAmbiante) ?? 1;
    const kP =
      FACTEUR_POSE && FACTEUR_POSE[methodePose]
        ? FACTEUR_POSE[methodePose]
        : 1.0;
    const kM = materiau === "aluminium" ? FACTEUR_ALUMINIUM ?? 0.62 : 1.0;
    const kTotal = kT * kP * kM;

    const rho20 =
      RESISTIVITE && RESISTIVITE[materiau] ? RESISTIVITE[materiau] : 0.0178;
    const alpha =
      COEFF_TEMP && COEFF_TEMP[materiau] ? COEFF_TEMP[materiau] : 0.0039;
    const rho70 = rho20 * (1 + alpha * (70 - 20));

    const sections = SECTIONS_NORMALISEES || [1.5, 2.5, 4, 6, 10, 16, 25];

    for (const section of sections) {
      const I0 =
        COURANT_ADMISSIBLE_CUIVRE_B2 && COURANT_ADMISSIBLE_CUIVRE_B2[section]
          ? COURANT_ADMISSIBLE_CUIVRE_B2[section]
          : 0;
      const Iz = I0 * kTotal;

      if (Iz < Ib) continue;

      const facteurChute = estTriphase ? Math.sqrt(3) : 2;
      const chuteTensionV = (facteurChute * longueur * Ib * rho70) / section;
      const chuteTensionPourcent = (chuteTensionV / tensionSaine) * 100;

      if (chuteTensionPourcent <= deltaUmax) {
        const In = this.calibrerDisjoncteur(Ib, Iz);

        return {
          section,
          materiau,
          courantEmploi: Math.round(Ib * 100) / 100,
          courantAdmissible: Math.round(Iz * 100) / 100,
          protection: In,
          chuteTension: Math.round(chuteTensionPourcent * 100) / 100,
          chuteTensionMax: deltaUmax,
          ddr: {
            type: "B",
            sensibilite: 30,
            norme: "IEC 62955 / NFC 15-100",
          },
          methodePose,
          facteursCorrection: {
            kT,
            kP,
            kM,
            total: kTotal,
          },
        };
      }
    }

    throw new Error(
      `Section standard AC insuffisante pour ${puissanceAC}W sur ${longueur}m.`
    );
  }

  private interpolerFacteurTemperature(
    temperature: number
  ): number | undefined {
    if (!FACTEUR_TEMPERATURE_PVC) return 1.0;

    const keys = Object.keys(FACTEUR_TEMPERATURE_PVC);
    if (keys.length === 0) return 1.0;

    const temperatures = keys.map(Number).sort((a, b) => a - b);

    const firstTemp = temperatures[0];
    const lastTemp = temperatures[temperatures.length - 1];

    if (firstTemp !== undefined && temperature <= firstTemp) {
      return FACTEUR_TEMPERATURE_PVC[firstTemp];
    }
    if (lastTemp !== undefined && temperature >= lastTemp) {
      return FACTEUR_TEMPERATURE_PVC[lastTemp];
    }

    for (let i = 0; i < temperatures.length - 1; i++) {
      const t1 = temperatures[i];
      const t2 = temperatures[i + 1];

      if (
        t1 !== undefined &&
        t2 !== undefined &&
        temperature >= t1 &&
        temperature <= t2
      ) {
        const f1 = FACTEUR_TEMPERATURE_PVC[t1];
        const f2 = FACTEUR_TEMPERATURE_PVC[t2];
        const ratio = (temperature - t1) / (t2 - t1);

        if (f1 !== undefined && f2 !== undefined) {
          return f1 + (f2 - f1) * ratio;
        }
      }
    }
    return 0.71;
  }

  private calibrerFusibleDC(InMin: number, InMax: number): number {
    const fusibles = CALIBRES_FUSIBLES_DC || [10, 12, 15, 20, 25, 30];
    const calibre = fusibles.find((c) => c >= InMin && c <= InMax);
    if (calibre !== undefined) return calibre;

    const calibreSecurite = fusibles.find((c) => c >= InMin);
    if (calibreSecurite !== undefined) return calibreSecurite;

    return Math.ceil(InMin); // Fallback dynamique ultime si le tableau est vide
  }

  private calibrerDisjoncteur(Ib: number, Iz: number): number {
    const disjoncteurs = CALIBRES_DISJONCTEURS || [
      10, 16, 20, 25, 32, 40, 50, 63,
    ];
    const In = disjoncteurs.find((c) => c >= Ib && c <= Iz);
    if (In !== undefined) return In;

    throw new Error(
      `Conflit de calibrage disjoncteur : Impossible de trouver un calibre (In) tel que Ib (${Math.round(
        Ib
      )}A) <= In <= Iz (${Math.round(Iz)}A).`
    );
  }

  verifierSelectivite(
    protectionAmont: { calibre: number; type: string; temporisation?: number },
    protectionAval: { calibre: number; type: string; temporisation?: number }
  ): {
    selectif: boolean;
    typeSelectivite: "ampèremétrique" | "chronométrique" | "aucune";
    ratio: number;
    recommandation?: string;
  } {
    const amontCalibre = protectionAmont?.calibre ?? 1;
    const avalCalibre = protectionAval?.calibre ?? 1;

    // Sécurité contre une division par zéro
    const avalCalibreSain = avalCalibre > 0 ? avalCalibre : 1;

    const ratioAmpere = amontCalibre / avalCalibreSain;
    const selectifAmpere = ratioAmpere >= 1.6;

    const tempAmont = protectionAmont?.temporisation || 0;
    const tempAval = protectionAval?.temporisation || 0;
    const selectifChrono = tempAmont > tempAval;

    const selectif = selectifAmpere || selectifChrono;
    const typeSelectivite = selectifChrono
      ? "chronométrique"
      : selectifAmpere
      ? "ampèremétrique"
      : "aucune";

    return {
      selectif,
      typeSelectivite,
      ratio: Math.round(ratioAmpere * 100) / 100,
      recommandation: !selectif
        ? `Le ratio de sélectivité (${ratioAmpere.toFixed(
            1
          )}) est inférieur à 1.6. Risque de déclenchement intempestif de la protection générale.`
        : undefined,
    };
  }
}

export const cablageEtProtectionsService = new CablageEtProtectionsService();
