import type { FastifyInstance } from "fastify";
import { dimensionnementController } from "../controllers/dimensionnement.controller.js";

export default async function webRoutes (fastify: FastifyInstance) {
  // page accueil
  fastify.get('/', async (req, reply) => {
    return reply.view('pages/index.ejs')
  });
  
  // traitement formulaire et dumensionnement PV
  fastify.post('/dimensionner', dimensionnementController.dimensionnementPV);
};
