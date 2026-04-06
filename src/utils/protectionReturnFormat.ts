export const protectionReturn (natureAppareillage:string, natureCourant: string, courantMax: number, position: string){
   return {
      equipement: natureAppareillage,
      type: natureCourant,
      Icc: courantMax,
      localisation: position
    };
};