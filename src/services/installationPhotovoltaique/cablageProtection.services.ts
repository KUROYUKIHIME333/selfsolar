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
    ResultatDimensionnementCablage
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
    CALIBRES_DISJONCTEURS
} from "../../utils/constantesPhysiques.utils.js"


// Service de dimensionnement des câbles et protections électriques
export class CablageEtProtectionsService {

    // Dimensionnement complet du câblage DC et des protections associées
    dimensionnerCablesDC(
        resultatModules: ResultatModulesPV,
        panneauParametres: ParametresSTCPanneau,
        longueurString: number = 15,
        longueurPrincipal: number = 10,
        temperatureAmbiante: number = 40,
        nombreStrings: number,
        materiau: MateriauConducteur = "cuivre",
        methodePose: MethodePose = "conduit_surface",
        conditionEnvironnement: ConditionEnvironnement = "chaud"
    ): ResultatDimensionnementCablage {

        const {
            courantCourtCircuit: Isc,
            tensionMPP: Vmpp,
            tensionVoc
        } = panneauParametres;

        const avertissements: string[] = [];
        const sectionsUtilisees: number[] = [];

        // Ajustement température
        let tempAmbianteEffective = temperatureAmbiante;
        let tempMaxConducteur = TEMP_MAX_CONDUCTEUR["H1Z2Z2-K"];

        if (conditionEnvironnement === "extreme" || conditionEnvironnement === "tres_chaud") {
            tempAmbianteEffective = Math.max(temperatureAmbiante, 50);
            avertissements.push(
                `Condition extrême: température ambiante ${tempAmbianteEffective}°C - Dé-rating appliqué`
            );
        }

        const tempConducteurCalculee = Math.min(
            tempAmbianteEffective + 20,
            tempMaxConducteur
        );

        // Courant de dimensionnement
        const courantDimensionnement = Isc * 1.25;

        // Câble par string
        const cableString = this.calculerSectionCableDC(
            longueurString,
            courantDimensionnement,
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

        // Câble principal DC
        const facteurFoisonnement = nombreStrings > 3 ? 0.8 : 1.0;
        const courantTotal = nombreStrings * courantDimensionnement * facteurFoisonnement;
        const tensionSystemeDC = resultatModules.tensionStringSTC;
        const chuteTensionMaxPrincipal = 2.0;

        const cablePrincipal = this.calculerSectionCableDC(
            longueurPrincipal,
            courantTotal,
            tensionSystemeDC,
            chuteTensionMaxPrincipal,
            tempAmbianteEffective,
            tempConducteurCalculee,
            materiau,
            methodePose,
            Math.min(nombreStrings, 6),
            "H1Z2Z2-K"
        );
        sectionsUtilisees.push(cablePrincipal.section);

        // Protections string (fusibles)
        const protectionsString: ProtectionDC[] = [];

        if (nombreStrings > 2) {
            const InMin = Isc * 1.5;
            const InMax = Isc * 2.0;
            const calibreFusible = this.calibrerFusibleDC(InMin, InMax);

            protectionsString.push({
                type: "fusible",
                calibre: calibreFusible,
                tensionAssignee: Math.ceil(resultatModules.vocStringFroid * 1.2),
                pouvoirCoupure: 10,
                norme: "IEC 60269-6",
                emplacement: `Boîte de jonction DC - ${nombreStrings} strings`,
                caracteristiques: `gPV - fusible photovoltaïque ${calibreFusible}A`
            });
        }

        // Protections onduleur DC
        const protectionOnduleurDC: ProtectionDC[] = [];

        protectionOnduleurDC.push({
            type: "sectionneur",
            tensionAssignee: Math.ceil(resultatModules.vocStringFroid * 1.2),
            norme: "IEC 60947-3",
            emplacement: "Entrée onduleur DC - coupure maintenance",
            caracteristiques: `Un ≥ ${Math.ceil(resultatModules.vocStringFroid * 1.2)}V, In ≥ ${Math.ceil(courantTotal * 1.25)}A`
        });

        if (courantTotal > 50) {
            const calibreDisjoncteur = this.calibrerDisjoncteur(courantTotal * 1.25, Infinity);
            protectionOnduleurDC.push({
                type: "disjoncteur",
                calibre: calibreDisjoncteur,
                tensionAssignee: Math.ceil(resultatModules.vocStringFroid * 1.2),
                pouvoirCoupure: 6,
                norme: "IEC 60947-2",
                emplacement: "Protection entrée DC onduleur",
                caracteristiques: `Courbe C ou D, ${calibreDisjoncteur}A`
            });
        }

        // ✅ CORRECTION : parafoudreDC est un objet ProtectionDC, pas un tableau
        const typeParafoudre = (longueurString > 10 || conditionEnvironnement === "extreme")
            ? "Type 1+2 (Imax 12.5kA 10/350μs)"
            : "Type 2 (Imax 5kA 8/20μs)";

        const parafoudreDC: ProtectionDC = {
            type: "parafoudre",
            tensionAssignee: Math.ceil(resultatModules.vocStringFroid * 1.2),
            norme: "IEC 61643-31",
            emplacement: longueurString > 10
                ? "Boîte jonction + entrée onduleur"
                : "Entrée onduleur DC",
            caracteristiques: `${typeParafoudre} - Up ≤ 2.0kV, Uc ≥ ${Math.ceil(resultatModules.vocStringFroid * 1.2)}V`
        };

        // Vérification chute tension
        const chuteTensionGlobale = cableString.chuteTensionPourcent + cablePrincipal.chuteTensionPourcent;
        const verificationChuteTension = chuteTensionGlobale <= 3.0;

        if (!verificationChuteTension) {
            avertissements.push(
                `Chute tension globale DC ${chuteTensionGlobale.toFixed(2)}% > 3% recommandé`
            );
        }

        if (materiau === "aluminium") {
            avertissements.push(
                `Aluminium utilisé: vérifier compatibilité galvanique et serrage adapté`
            );
        }

        // ✅ CORRECTION : retour avec parafoudreDC comme objet unique
        return {
            cablesString: Array(nombreStrings).fill(cableString),
            cablePrincipalDC: cablePrincipal,
            protectionsString,
            protectionOnduleurDC,
            parafoudreDC,  // ✅ Objet unique, pas tableau
            sectionsStandardUtilisees: [...new Set(sectionsUtilisees)],
            verificationChuteTensionGlobale: verificationChuteTension,
            avertissements
        };
    }

    // Calcule la section de câble DC
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

        const rho20 = RESISTIVITE[materiau];
        const alpha = COEFF_TEMP[materiau];
        const rho = rho20 * (1 + alpha * (temperatureConducteur - 20));

        const kT = this.interpolerFacteurTemperature(temperatureAmbiante);
        const kP = FACTEUR_POSE[methodePose];
        const kG = FACTEUR_GROUPEMENT[Math.min(nombreCircuitsGroupe, 6)] || 0.57;
        const kM = materiau === "aluminium" ? FACTEUR_ALUMINIUM : 1.0;
        const kTotal = kT * kP * kG * kM;

        for (const section of SECTIONS_NORMALISEES) {
            const I0 = COURANT_ADMISSIBLE_CUIVRE_B2[section] || 0;
            const Iz = I0 * kTotal;

            if (Iz < courant) continue;

            const chuteTensionV = (2 * longueur * courant * rho) / section;
            const chuteTensionPourcent = (chuteTensionV / tension) * 100;

            if (chuteTensionPourcent <= chuteTensionMax) {
                const resistanceLineique = rho * 1000 / section;

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
                        total: Math.round(kTotal * 100) / 100
                    }
                };
            }
        }

        const sectionMinTheorique = (2 * longueur * courant * rho) / (tension * (chuteTensionMax / 100));
        const sectionNormaliseeSuivante = SECTIONS_NORMALISEES.find(s => s >= sectionMinTheorique);

        if (sectionNormaliseeSuivante) {
            throw new Error(
                `Section standard insuffisante. Théorique: ${Math.ceil(sectionMinTheorique)} mm², ` +
                `disponible: ${sectionNormaliseeSuivante} mm²`
            );
        }

        throw new Error(
            `Dimensionnement impossible: 300mm² ${materiau} insuffisant pour ${courant}A sur ${longueur}m`
        );
    }

    // Dimensionnement câblage AC
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

        const estTriphase = tensionAC > 250 || tensionAC === 400;

        const Ib = estTriphase
            ? puissanceAC / (Math.sqrt(3) * tensionAC * cosPhi)
            : puissanceAC / (tensionAC * cosPhi);

        const deltaUmax = typeCharge === "eclairage" ? 3.0 : 5.0;

        const kT = this.interpolerFacteurTemperature(temperatureAmbiante);
        const kP = FACTEUR_POSE[methodePose];
        const kM = materiau === "aluminium" ? FACTEUR_ALUMINIUM : 1.0;
        const kTotal = kT * kP * kM;

        for (const section of SECTIONS_NORMALISEES) {
            const I0 = COURANT_ADMISSIBLE_CUIVRE_B2[section] || 0;
            const Iz = I0 * kTotal;

            if (Iz < Ib) continue;

            const rho70 = RESISTIVITE[materiau] * (1 + COEFF_TEMP[materiau] * (70 - 20));
            const facteurConfig = estTriphase ? Math.sqrt(3) : 2;
            const chuteTensionV = (facteurConfig * longueur * Ib * rho70) / section;
            const chuteTension = (chuteTensionV / tensionAC) * 100;

            if (chuteTension <= deltaUmax) {
                const In = this.calibrerDisjoncteur(Ib, Iz);

                return {
                    section,
                    materiau,
                    courantEmploi: Math.round(Ib * 100) / 100,
                    courantAdmissible: Math.round(Iz * 100) / 100,
                    protection: In,
                    chuteTension: Math.round(chuteTension * 100) / 100,
                    chuteTensionMax: deltaUmax,
                    ddr: {
                        type: "B",
                        sensibilite: 30,
                        norme: "IEC 62955 / NFC 15-100 §722"
                    },
                    methodePose,
                    facteursCorrection: {
                        kT,
                        kP,
                        kM,
                        total: kTotal
                    }
                };
            }
        }

        throw new Error(
            `Section standard insuffisante pour câble AC ${puissanceAC}W sur ${longueur}m`
        );
    }

    private interpolerFacteurTemperature(temperature: number): number {
        const temperatures = Object.keys(FACTEUR_TEMPERATURE_PVC)
            .map(Number)
            .sort((a, b) => a - b);

        if (temperature <= temperatures[0]) {
            return FACTEUR_TEMPERATURE_PVC[temperatures[0]];
        }
        if (temperature >= temperatures[temperatures.length - 1]) {
            return FACTEUR_TEMPERATURE_PVC[temperatures[temperatures.length - 1]];
        }

        for (let i = 0; i < temperatures.length - 1; i++) {
            const t1 = temperatures[i];
            const t2 = temperatures[i + 1];

            if (temperature >= t1 && temperature <= t2) {
                const f1 = FACTEUR_TEMPERATURE_PVC[t1];
                const f2 = FACTEUR_TEMPERATURE_PVC[t2];
                const ratio = (temperature - t1) / (t2 - t1);
                return f1 + (f2 - f1) * ratio;
            }
        }

        return 0.71;
    }

    private calibrerFusibleDC(InMin: number, InMax: number): number {
        const calibre = CALIBRES_FUSIBLES_DC.find(c => c >= InMin && c <= InMax);
        if (calibre) return calibre;

        const calibreProche = CALIBRES_FUSIBLES_DC.find(c => c >= InMin && c <= InMax * 1.1);
        if (calibreProche) return calibreProche;

        const calibreSecurite = CALIBRES_FUSIBLES_DC.find(c => c >= InMin);
        if (calibreSecurite) return calibreSecurite;

        throw new Error(`Aucun calibre fusible DC pour ${InMin}A minimum`);
    }

    private calibrerDisjoncteur(Ib: number, Iz: number): number {
        const In = CALIBRES_DISJONCTEURS.find(c => c >= Ib && c <= Iz);
        if (In) return In;

        const InAvecMarge = CALIBRES_DISJONCTEURS.find(c => {
            const I2 = 1.45 * c;
            return c >= Ib && I2 <= 1.45 * Iz;
        });

        if (InAvecMarge) return InAvecMarge;

        throw new Error(`Aucun calibre disjoncteur pour IB=${Math.round(Ib)}A, IZ=${Math.round(Iz)}A`);
    }

    // Vérification sélectivité protections
    verifierSelectivite(
        protectionAmont: { calibre: number; type: string; temporisation?: number },
        protectionAval: { calibre: number; type: string; temporisation?: number }
    ): {
        selectif: boolean;
        typeSelectivite: "ampèremétrique" | "chronométrique" | "aucune";
        ratio: number;
        recommandation?: string;
    } {
        const ratioAmpere = protectionAmont.calibre / protectionAval.calibre;
        const selectifAmpere = ratioAmpere >= 1.6;

        const tempAmont = protectionAmont.temporisation || 0;
        const tempAval = protectionAval.temporisation || 0;
        const selectifChrono = tempAmont > tempAval;

        const selectif = selectifAmpere || selectifChrono;
        const typeSelectivite = selectifChrono ? "chronométrique" :
            (selectifAmpere ? "ampèremétrique" : "aucune");

        return {
            selectif,
            typeSelectivite,
            ratio: Math.round(ratioAmpere * 100) / 100,
            recommandation: !selectif
                ? `Ratio ${ratioAmpere.toFixed(1)} < 1.6, risque déclenchement amont`
                : undefined
        };
    }
}

export const cablageEtProtectionsService = new CablageEtProtectionsService();