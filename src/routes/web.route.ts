import type { FastifyInstance } from "fastify";
import { dimensionnementController } from "../controllers/dimensionnement.controller.js";

export default async function webRoutes (fastify: FastifyInstance) {
  // page accueil
  fastify.get('/', async (req, reply) => {
    return reply.view('pages/index.ejs')
  }/*cette fobction est le cobtroller calculate controleur*/);
  
  // traitement formulaire et dumensionnement PV
  fastify.post('/dimensionner', dimensionnementController.dimensionnementPV);
};
