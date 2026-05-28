export const controllerErrorHandler = (error: unknown, name: string) => {
  const message =
    error instanceof Error
      ? error.message
      : "Erreur inconnue lors de l'analyse de consommation.";
  return {
    success: false,
    error: `${name}: ${message}`,
    data: null,
  };
};
