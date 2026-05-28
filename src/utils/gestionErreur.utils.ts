export const controllerErrorHandler = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Erreur inconnue lors de l'analyse de consommation.";
  return {
    success: false,
    error: `[Analyse Geographique] : ${message}`,
    data: null,
  };
};
