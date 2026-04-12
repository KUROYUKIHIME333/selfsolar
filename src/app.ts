import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
// import { webRoutes, apiRoutes } from './routes/index.js';


export const buildApp = async (): Promise<FastifyInstance> => {
    const app = fastify({
        logger: {
            transport: process.env.NODE_ENV !== 'production' ? {
                target: 'pino-pretty',
                options: {
                    colorize: true
                }
            }
                : undefined, //WARNING: En prod : JSON brut, plus performant
            serializers: {
                req: (req) => ({ method: req.method, url: req.url, id: req.id })
            }
        },
        bodyLimit: 5 * 1024 * 1024, // 5MB
        ignoreTrailingSlash: true,
        requestTimeout: 30_000, // 30 secondes
        genReqId: () => crypto.randomUUID(),
        ajv: {
            customOptions: {
                removeAdditional: process.env.NODE_ENV !== 'production' ? 'all' : undefined, //WARNING: Strip propriétés non déclarées
                // useDefaults: true, // Applique les valeurs par défaut
                // coerceTypes: false // Ne pas coercer les types
            }
        }
    });

    // Plugins core
    // await app.register(cors, { origin: process.env.CORS_ORIGIN ?? "*" });
    await app.register(sensible);

    // Routes
    // await app.register(webRoutes, {
    //     prefix: "/web/"
    // });
    // await app.register(apiRoutes, {
    //     prefix: "/api/"
    // });

    return app;

};