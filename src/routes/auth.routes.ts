import { FastifyInstance } from "fastify";
import { auth } from "../lib/auth.js";

export const authRoutes = async (app: FastifyInstance) => {
  app.all("/api/auth/*", async (req, reply) => {
    // Convertir la requête Fastify en Request Web standard
    const request = new Request(`http://${req.headers.host}${req.raw.url}`, {
      method: req.raw.method,
      headers: new Headers(req.headers as any),
      // Better Auth a besoin du body pour les requêtes POST/PUT
      body: req.raw.method !== "GET" ? JSON.stringify(req.body) : null,
    });

    // Passer la requête au handler de Better Auth
    const response = await auth.handler(request);

    // Mapper la réponse de Better Auth vers Fastify
    reply.status(response.status);

    // Transférer les headers (cookies de session, etc.)
    response.headers.forEach((value, key) => {
      reply.header(key, value);
    });

    return response.body;
  });
};
