export type Equipement = {
  nom: string | null,
  puissance: number,
  tempsJournalier: number
};

export type EnergieEquipement = {
  nom: string | null,
  energie: number,
};

export class ConsoJournaliereService {
  energieEquipements(equipementDatas: Equipement[]){
    return equipementDatas.map((equipement) => (
        {
          nom: equipement.nom,
          energie: equipement.puissance * equipement.tempsJournalier
        }
      ));
  };
  
  energieTotale(energieEquipements: EnergieEquipement[]){
    return energieEquipements.reduce((acc, { energie }) => acc + energie, 0);
  };
  
  puissanceTotalCharge(equipementDatas: Equipement[]){
    return equipementDatas.reduce((acc, { puissance }) => acc + puissance, 0)
  };
}

export const consoJournaliereService = new ConsoJournaliereService();