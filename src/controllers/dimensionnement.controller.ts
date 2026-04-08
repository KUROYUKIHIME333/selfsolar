import type { FastifyRequest, FastifyReply } from "fastify";
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

// Forme brute envoyée par le formulaire HTML (application/x-www-form-urlencoded)
type FormBody = {
  equipements: Record<string, { nom: string, puissance: string, tempsJournalier: string }>;
  "localisation[lat]": string;
  "localisation[long]": string;
  inGridNoBatterie?: string;        // checkbox → "on" | undefined
  autonomie?: string;
  typeBatteries?: string;
  caracteristiquesPanneau: string;  // JSON sérialisé par le select
  caracteristiquesBatterie: string; // JSON sérialisé par le select
  priorites?: string | string[];    // checkboxes multiples
  typeInstallation?: string;
  contientMoteurs?: string;         // checkbox → "on" | undefined
};

export class DimensionnementController {
  async dimensionnementPV(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.body as FormBody;

    try {
      // ── Désérialisation du formulaire ────────────────────────────────────

      // Equipements : { "0": { nom, puissance, tempsJournalier }, "1": ... }
      const equipements: Equipement[] = Object.values(raw.equipements || {}).map(e => ({
        nom: e.nom || null,
        puissance: parseFloat(e.puissance) || 0,
        tempsJournalier: parseFloat(e.tempsJournalier) || 0,
      }));

      const localisation: Localisation = {
        lat: parseFloat(raw["localisation[lat]"]),
        long: parseFloat(raw["localisation[long]"]),
      };

      // Les selects envoient la valeur JSON de l'option sélectionnée
      const caracteristiquesPanneau: Panneau = JSON.parse(raw.caracteristiquesPanneau);
      const caracteristiquesBatterie: Batterie = JSON.parse(raw.caracteristiquesBatterie);

      const inGridNoBatterie: boolean = raw.inGridNoBatterie === "on";
      const contientMoteurs: boolean  = raw.contientMoteurs === "on";
      const autonomie: number         = parseInt(raw.autonomie || "1") || 1;
      const typeInstallation: TypeInstallation = (raw.typeInstallation as TypeInstallation) || "isole";

      // typeBatteries : déduit depuis les caractéristiques de la batterie choisie
      const battData = JSON.parse(raw.caracteristiquesBatterie) as { type?: string };
      const typeBatteries: TypeBatteries = (battData.type as TypeBatteries) || null;

      // priorites : peut être absent, une string ou un tableau
      let priorites: Priorites[] = [];
      if (raw.priorites) {
        priorites = (Array.isArray(raw.priorites) ? raw.priorites : [raw.priorites]) as Priorites[];
      }

      // ── 1. Énergie et Charge ─────────────────────────────────────────────
      const eDetaillee = consoJournaliereService.energieEquipements(equipements);
      const ec         = consoJournaliereService.energieTotale(eDetaillee);
      const pCharge    = consoJournaliereService.puissanceTotalCharge(equipements);

      // ── 2. Données Géographiques ─────────────────────────────────────────
      const hsp        = await localisationService.determinerHSP(localisation) || 4.5;
      const hemisphere = localisationService.determinerHemisphere(localisation.lat);
      const orientation = localisationService.determinerOrientation(localisation.lat);
      const angle      = localisationService.determinerAngleOptimal(localisation.lat);

      // ── 3. Champ Photovoltaïque ──────────────────────────────────────────
      const k          = generateursService.determinerK(inGridNoBatterie);
      const pc         = generateursService.puissanceCrete(ec, hsp, k);
      const usyst      = generateursService.tensionSysteme(pc);

      const nTotal     = Math.ceil(generateursService.panneauTotal(pc, caracteristiquesPanneau.puissanceCrete));
      const nSerie     = Math.ceil(generateursService.panneauxSerie(usyst, caracteristiquesPanneau.U));
      const nParallele = Math.ceil(generateursService.panneauxParallele(nSerie, nTotal));

      // ── 4. Parc Batteries ────────────────────────────────────────────────
      let stockage = null;
      if (!inGridNoBatterie) {
        const dod            = batteriesService.determinerDoD(typeBatteries) || 0.6;
        const capaciteRequise = batteriesService.capaciteTotale(usyst, autonomie, dod, ec);
        const nbattSerie     = Math.ceil(usyst / caracteristiquesBatterie.U);
        const nbattTotal     = Math.ceil(capaciteRequise / caracteristiquesBatterie.capacite) * nbattSerie;
        const nbattParallele = Math.ceil(nbattTotal / nbattSerie);

        stockage = {
          capaciteAh: capaciteRequise,
          nbTotal: nbattTotal,
          montage: { serie: nbattSerie, parallele: nbattParallele }
        };
      }

      // ── 5. Électronique de puissance ─────────────────────────────────────
      const regulateur  = regulateurService.caracteristiquesRegulateur(usyst, caracteristiquesPanneau.Icc, nParallele);
      const typeRegul   = regulateurService.typeRegulateur(pc, priorites);
      const onduleur    = onduleurService.caracteristiquesOnduleur(pCharge, usyst);
      const typeOndul   = onduleurService.determinerTypeOnduleur(contientMoteurs, typeInstallation);

      // ── 6. Protections ───────────────────────────────────────────────────
      const imaxOnduleur = onduleur.puissanceMin / usyst;
      const protections = {
        generalPV:        protectionsService.disjoncteurPvRegulateur(nParallele * caracteristiquesPanneau.Icc),
        individuelString: protectionsService.protectionString(caracteristiquesPanneau.Icc),
        batterieOnduleur: protectionsService.disjoncteurBattOnduleur(imaxOnduleur),
        sectionneurBatt:  protectionsService.sectionneurBatterie(stockage?.capaciteAh || 0),
      };

      // ── 7. Réponse ───────────────────────────────────────────────────────
      return reply.view('pages/results.ejs', {
        resultat: {
          energie:    { journaliere: ec, puissanceMax: pCharge },
          geographie: { hsp, hemisphere },
          panneaux: {
            puissanceTotale: pc,
            nombre:          nTotal,
            serie:           nSerie,
            parallele:       nParallele,
            tensionSysteme:  usyst,
            orientation,
            inclinaison:     angle,
          },
          stockage,
          electronique: {
            regulateur: { ...regulateur, type: typeRegul },
            onduleur:   { ...onduleur,   type: typeOndul },
          },
          protections,
        }
      });

    } catch (error: any) {
      console.error("Erreur Dimensionnement:", error);
      return reply.code(500).send({ error: "Erreur lors du calcul technique", detail: error.message });
    }
  }
}

export const dimensionnementController = new DimensionnementController();
