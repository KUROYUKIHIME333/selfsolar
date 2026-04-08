import type { FastifyInstance } from "fastify";
import { dimensionnementController } from "../controllers/dimensionnement.controller.js";

export default async function apiRoutes (fastify: FastifyInstance) {
  fastify.get('/api/documentation', async (_req, reply) => {
    return reply.send({ message: 'Documentation à venir' });
  });

  fastify.post('/api/dimensionner', dimensionnementController.dimensionnementPV.bind(dimensionnementController));
};
