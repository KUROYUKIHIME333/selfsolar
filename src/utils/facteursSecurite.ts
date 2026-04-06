export const onduleurFacteur = 1.5; // Gère le courant d'appel des moteurs (frigos, pompes)
export const regulateurFacteur = 1.25; // Marge de sécurité pour l'échauffement du régulateur
export const disjoncteurPvRegulateurFacteur = 1.25; // Protection contre les pics d'irradiance (effet de bord des nuages)
export const disjoncteurStringFacteur = 1.5; // Spécifique aux fusibles gPV pour éviter les déclenchements intempestifs
export const protectionBatterieFacteur = 1.25; // Sécurité sur le circuit de décharge de l'onduleur
export const facteurChuteTensionMax = 0.03; // Limite de 3% de perte de tension dans les câbles DC
export const rendementOnduleur = 0.90; // Utilisé pour calculer le courant réel tiré sur les batteries