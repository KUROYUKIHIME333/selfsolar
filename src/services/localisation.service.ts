// Interface pour la structure de réponse de la NASA (simplifiée)
interface NasaPowerResponse {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: { [key: string]: number };
    };
  };
}

export type Localisation = {
  lat: number;
  long: number;
};

export class LocalisationService {
  determinerHemisphere(lat: number): 'N' | 'S' {
    return lat >= 0 ? 'N' : 'S';
  }

  //Calcule l'angle d'inclinaison optimal des panneaux avec la formule de Lunde pour l'optimisation annuelle.
  determinerAngleOptimal(lat: number): number {
    const absLat = Math.abs(lat);
    let angle: number;

    if (absLat < 15) {
      // Zone tropicale/équatoriale : l'angle suit la latitude avec un boost
      angle = absLat * 0.9 + 1;
    } else if (absLat >= 15 && absLat <= 25) {
      angle = absLat;
    } else {
      // Zones tempérées
      angle = absLat * 0.76 + 3.1;
    }

    // Sécurité auto-nettoyage : en RDC (lat proche de 0), 
    // on ne descend jamais en dessous de 10-15° pour évacuer l'eau et la poussière.
    return angle < 10 ? 10 : Math.round(angle);
  }

  // Orientation (Azimut) vers laquelle les panneaux doivent faire face.
  determinerOrientation(lat: number): string {
    return lat >= 0 ? "Plein SUD" : "Plein NORD";
  }

  async determinerHSP(position: Localisation): Promise<number | null> {
    const { lat, long } = position;
    const year = new Date().getFullYear() - 1; 
    const start = `${year}0101`;
    const end = `${year}1231`;
    
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${long}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP NASA: ${response.status}`);
      }
      
      const data: NasaPowerResponse = await response.json();
      const parameterData = data.properties.parameter.ALLSKY_SFC_SW_DWN;
      const values = Object.values(parameterData);
      
      if (values.length === 0) {
        console.warn("Aucune donnée d'irradiation trouvée.");
        return null;
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const hsp = sum / values.length;
      
      return Math.round(hsp * 100) / 100; 
    } catch (error) {
      console.error("Erreur lors de la récupération du HSP NASA:", error);
      return null;
    }
  }
}

export const localisationService = new LocalisationService();