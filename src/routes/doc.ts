import { FastifyInstance } from "fastify";

const routes = async (app: FastifyInstance) => {
    const handler = async (request: any, reply: any) => {
        const body = request.body as { name: string; email: string }
        reply.code(201)
        return { id: 'uuid-...', ...body }
    }

    // ── Syntaxe raccourcie ──────────────────────────────
    app.get('/hello', async (request, reply) => {
        return { message: 'Hello World' }
        // Retourner un objet = reply.send() implicite
    })

    // ── Paramètre de route ─────────────────────────────
    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string }
        return { id }
    })

    // ── Syntaxe complète (RouteOptions) ────────────────
    app.route({
        method: 'POST',
        url: '/',
        schema: {
            body: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                    name: { type: 'string', minLength: 2 },
                    email: { type: 'string', format: 'email' }
                }
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        email: { type: 'string' }
                    }
                }
            }
        },
        handler: async (request, reply) => {
            const body = request.body as { name: string; email: string }
            reply.code(201)
            return { id: 'uuid-...', ...body }
        }
    })


    // ── Multi-méthode sur une URL ─────────────────────
    app.route({
        method: ['GET', 'HEAD'],
        url: '/status',
        handler: async () => ({ ok: true })
    })

    //PARAMETRES QUERY STRING
    // Paramètre simple
    app.get('/users/:id', handler)
    // Paramètre wildcard (doit être en fin de path)
    app.get('/files/*', handler)
    // request.params['*'] === 'images/avatar.png'
    // Paramètre regex
    app.get('/users/:id(^\\d+$)', handler)
    // QueryString : automatiquement parsée
    app.get('/search', async (req) => {
        // GET /search?q=foo&page=2
        const { q, page } = req.query as { q: string; page: string }
        return { q, page: Number(page) }
    })

    // WARNING: Les valeurs de la querystring sont toujours des strings. 
    // WARNING: Valider et convertir via le schema ou manuellement. 
    // WARNING: Avec coerceTypes: true dans Ajv, la conversion est automatique.
}