import type { FastifyInstance } from "fastify";
import { dimensionnementController } from "../controllers/dimensionnement.controller.js";

export default async function apiRoutes (fastify: FastifyInstance) {
  // page accueil
  fastify.get('/api/documentation', async (req, reply) => {});
  
  
  // traitement formulaire et dumensionnement PV
  fastify.post('/api/dimensionner', ()=>{});
};
