import { FastifyReply } from "fastify";

export const controllerErrorHandler = (error: unknown, name: string) => {
  const message =
    error instanceof Error
      ? error.message
      : "Erreur inconnue lors de l'analyse de consommation.";

  console.log(`${name}: ${message}`);

  return {
    success: false,
    error: `${name}: ${message}`,
    data: null,
  };
};

// Format standard des reponses
export const sendResponse = (
  successValue: boolean,
  errorValue: string | null,
  dataValue: any
) => {
  return {
    success: successValue,
    error: errorValue,
    data: dataValue,
  };
};

// Fonctions utilitaires pour centraliser les réponses HTTP (controlleurs)
export const sendSuccess = (reply: FastifyReply, data: any, code = 200) => {
  const response = sendResponse(true, null, data);
  return reply.code(code).send(response);
};

export const sendError = (reply: FastifyReply, error: any, code = 400) => {
  // Si l'erreur provient de controllerErrorHandler et possède déjà une structure imbriquée
  const errorMessage =
    error && typeof error === "object"
      ? error.message || error.error || JSON.stringify(error)
      : error;
  const response = sendResponse(false, errorMessage, null);

  console.log(errorMessage);

  return reply.code(code).send(response);
};
