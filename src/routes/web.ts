import { FastifyInstance } from 'fastify'

export default async function (app: FastifyInstance) {
  // page accueil
  app.get('/', async () => {
    return reply.view('pages/index.ejs')
  }/*cette fobction est le cobtroller calculate controleur*/)
  
  // traitement formulaire
  app.post('/calculate', async (req, reply) => {
    return reply.view('pages/result.ejs', {}) // result
  } /*cette fobction est le cobtroller calculate controleur*/)
}
