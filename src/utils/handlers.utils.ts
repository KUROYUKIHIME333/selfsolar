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
