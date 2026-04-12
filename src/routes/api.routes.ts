import { FastifyInstance } from "fastify";

export const apiRoutes = async (app: FastifyInstance) => {
    app.get("/documentation", async (request, reply) => {
    });

    app.route({
        method: 'POST',
        url: '/dimensionner',
        schema: {
            body: {
                type: 'object',
                required: ['name', 'email'], //TODO: A changer
                properties: {
                    name: { type: 'string', minLength: 2 },
                    email: { type: 'string', format: 'email' }
                } //TODO: A changer
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        email: { type: 'string' }
                    } //TODO: A changer
                }
            }
        },
        handler: async (request, reply) => {
            const body = request.body as { name: string; email: string } //TODO: A changer
            reply.code(201)
            return { id: 'uuid-...', ...body }
        }
    })
};