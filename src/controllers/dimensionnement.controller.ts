import { FastifyRequest, FastifyReply } from "fastify";
import { batteriesService } from "../services/batteries.service.js";
import { consoJournaliereService } from "../services/consoJournaliere.service.js";
import { generateursService } from "../services/generateurs.service.js";
import { onduleurService } from "../services/onduleur.service.js";
import { regulateurService } from "../services/regulateur.service.js";
import { protectionsService } from "../services/protections.service.js";
import { localisationService } from "../services/localisation.service.js";
import type { Equipement } from "../services/consoJournaliere.service.js";
import type { Localisation } from "../services/localisation.service.js";

export type Panneau = { puissanceCrete: number, Icc: number, U: number };
export type Batterie = { capacite: number, U: number };
export type TypeBatteries = "plomb" | "lithium" | null;
export type Priorites = "rendement" | "performance" | "economie";
export type TypeInstallation = "pompage" | "reseau" | "isole";

export class DimensionnementController {
  async dimensionnementPV(req: FastifyRequest, res: FastifyReply) {
    const {
      equipements,
      localisation,
      inGridNoBatterie,
      autonomie,
      typeBatteries,
      caracteristiquesPanneau,
      caracteristiquesBatterie,
      priorites,
      typeInstallation,
      contientMoteurs
    } = req.body as {
      equipements: Equipement[],
      localisation: Localisation,
      inGridNoBatterie: boolean,
      autonomie: number,
      typeBatteries: TypeBatteries,
      caracteristiquesPanneau: Panneau,
      caracteristiquesBatterie: Batterie,
      priorites: Priorites[],
      typeInstallation: TypeInstallation,
      contientMoteurs: boolean
    };

    try {
      // 1. Énergie et Charge
      const eDetaillee = consoJournaliereService.energieEquipements(equipements);
      const ec = consoJournaliereService.energieTotale(eDetaillee);
      const pCharge = consoJournaliereService.puissanceTotalCharge(equipements);

      // 2. Données Géographiques
      const hsp = await localisationService.determinerHSP(localisation) || 4.5; // Fallback sécurisé
      const hemisphere = localisationService.determinerHemisphere(localisation.lat);
      const orientation = localisationService.determinerOrientation(localisation.lat);
      const angle = localisationService.determinerAngleOptimal(localisation.lat);

      // 3. Champ Photovoltaïque
      const k = generateursService.determinerK(inGridNoBatterie);
      const pc = generateursService.puissanceCrete(ec, hsp, k);
      const usyst = generateursService.tensionSysteme(pc);
      
      const nTotal = Math.ceil(generateursService.panneauTotal(pc, caracteristiquesPanneau.puissanceCrete));
      const nSerie = Math.ceil(generateursService.panneauxSerie(usyst, caracteristiquesPanneau.U));
      const nParallele = Math.ceil(generateursService.panneauxParallele(nSerie, nTotal));

      // 4. Parc Batteries
      let stockage = null;
      if (!inGridNoBatterie) {
        const dod = batteriesService.determinerDoD(typeBatteries) || 0.6;
        const capaciteRequise = batteriesService.capaciteTotale(usyst, autonomie || 1, dod, ec);
        
        const nbattSerie = Math.ceil(usyst / caracteristiquesBatterie.U);
        const nbattTotal = Math.ceil(capaciteRequise / caracteristiquesBatterie.capacite) * nbattSerie;
        const nbattParallele = Math.ceil(nbattTotal / nbattSerie);

        stockage = {
          capaciteAh: capaciteRequise,
          nbTotal: nbattTotal,
          montage: { serie: nbattSerie, parallele: nbattParallele }
        };
      }

      // 5. Électronique de puissance
      const regulateur = regulateurService.caracteristiquesRegulateur(usyst, caracteristiquesPanneau.Icc, nParallele);
      const typeRegul = regulateurService.typeRegulateur(pc, priorites);

      const onduleur = onduleurService.caracteristiquesOnduleur(pCharge, usyst);
      const typeOndul = onduleurService.determinerTypeOnduleur(contientMoteurs, typeInstallation);

      // 6. Protections (Calcul du courant max onduleur pour protection batterie)
      const imaxOnduleur = (onduleur.puissanceMin / usyst);
      
      const protections = {
        generalPV: protectionsService.disjoncteurPvRegulateur(nParallele * caracteristiquesPanneau.Icc),
        individuelString: protectionsService.protectionString(caracteristiquesPanneau.Icc),
        batterieOnduleur: protectionsService.disjoncteurBattOnduleur(imaxOnduleur),
        sectionneurBatt: protectionsService.sectionneurBatterie(stockage?.capaciteAh || 0)
      };

      // 7. Réponse
      return res.view('pages/result.ejs', {
        resultat: {
          energie: { journaliere: ec, puissanceMax: pCharge },
          geographie: { hsp, hemisphere },
          panneaux: { 
            puissanceTotale: pc, 
            nombre: nTotal, 
            serie: nSerie, 
            parallele: nParallele,
            tensionSysteme: usyst,
            orientation: orientation,
            inclinaison: angle
          },
          stockage,
          electronique: {
            regulateur: { ...regulateur, type: typeRegul },
            onduleur: { ...onduleur, type: typeOndul }
          },
          protections
        }
      });

    } catch (error: any) {
      console.error("Erreur Dimensionnement:", error);
      return res.status(500).send({ error: "Erreur lors du calcul technique" });
    }
  }
}

export const dimensionnementController = new DimensionnementController();