export type ISO8528 =
  | "COP" // Continuous Power
  | "PRP" // Prime Power
  | "LTP" // Limited-Time Running Power
  | "ESP"; // Emergency Standby Power

// Un GE dimensionné en ESP ne peut pas fonctionner en continu.
// Spécifier la classe à l'achat selon l'usage réel prévu.
// La confusion entre PRP et ESP est fréquente et entraîne une sur-usure moteur.


