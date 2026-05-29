import { FastifyReply } from "fastify";

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

// Fonctions utilitaires pour centraliser les réponses HTTP
export const sendSuccess = (reply: FastifyReply, data: any, code = 200) => {
  return reply.code(code).send({
    success: true,
    error: null,
    data: data,
  });
};

export const sendError = (reply: FastifyReply, error: any, code = 400) => {
  // Si l'erreur provient de controllerErrorHandler et possède déjà une structure imbriquée
  const errorMessage =
    error && typeof error === "object"
      ? error.message || error.error || JSON.stringify(error)
      : error;

  return reply.code(code).send({
    success: false,
    error: errorMessage,
    data: null,
  });
};
