import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { apiRoutes } from './routes/api.routes.js';
import crypto from "node:crypto";

export const buildApp = async (): Promise<FastifyInstance> => {
    const app = fastify({
        logger: {
            transport: process.env.NODE_ENV !== 'production' ? {
                target: 'pino-pretty',
                options: {
                    colorize: true
                }
            } : undefined,
            serializers: {
                req: (req) => ({ method: req.method, url: req.url, id: req.id })
            }
        },
        bodyLimit: 5 * 1024 * 1024,
        ignoreTrailingSlash: true,
        requestTimeout: 30_000,
        genReqId: () => crypto.randomUUID(),
        ajv: {
            customOptions: {
                removeAdditional: process.env.NODE_ENV !== 'production' ? 'all' : undefined,
            }
        }
    });

    // Config @fastify/swagger (Génération de la doc)
    await app.register(swagger, {
        openapi: {
            info: {
                title: "SelfSolar API",
                description: "API de dimensionnement photovoltaïque conforme aux normes NFC 15-100, IEC 61215, IEC 62109",
                version: "2.0.0",
                contact: {
                    name: "Support SelfSolar",
                    url: "https://github.com/KUROYUKIHIME333/selfsolar"
                },
                license: {
                    name: "ISC",
                    url: "https://opensource.org/licenses/ISC"
                }
            },
            servers: [
                {
                    url: "http://localhost:3000",
                    description: "Serveur local"
                }
            ],
            tags: [
                { name: "photovoltaique", description: "Dimensionnement installations solaires" },
                { name: "système", description: "État et santé de l'API" }
            ],
            components: {
                securitySchemes: {
                    apiKey: { type: "apiKey", name: "x-api-key", in: "header" },
                    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
                }
            }
        }
    });

    // Config @fastify/swagger-ui (Interface visuelle)
    await app.register(swaggerUi, {
        routePrefix: "/documentation",
        staticCSP: false,
        transformSpecificationClone: true,
        uiConfig: {
            docExpansion: "list",
            deepLinking: true,
            tryItOutEnabled: true,
            validatorUrl: null,
        },
        // On modifie le HTML au vol
        transformStaticCSP: (header) => header, // Garder le header tel quel
        transformSpecification: (swaggerObject) => swaggerObject,
    });

    // On intercepte les requêtes vers les fichiers pour eviter des problemes 
    // (par exemple, des erreurs: 
    // {"statusCode":500,"code":"FST_ERR_BAD_STATUS_CODE","error":"Internal Server Error","message":"Called reply with an invalid status code: /documentation/"})
    app.addHook('onRequest', async (request, reply) => {
        const url = request.url;

        // Force la redirection vers le slash (Indispensable pour les chemins relatifs)
        if (url === '/documentation') {
            return reply.code(301).redirect('/documentation/');
        }

        // Si le fichier n'est pas trouvé localement, on redirige vers le CDN de secours
        if (url.includes('swagger-ui-bundle.js')) {
            return reply.redirect('https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js');
        }
        if (url.includes('swagger-ui-standalone-preset.js')) {
            return reply.redirect('https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js');
        }
        if (url.includes('swagger-ui.css')) {
            return reply.redirect('https://unpkg.com/swagger-ui-dist@5/swagger-ui.css');
        }
    });

    // Plugins core
    await app.register(cors, {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    });
    await app.register(sensible);

    // Routes
    await app.get("/", async () => {
        return {
            api: "SelfSolar API",
            version: "2.0.0",
            status: "opérationnel",
            endpoints: {
                pv: "/api/v1/pv",
                documentation: "/documentation"
            }
        };
    });

    // Routes api
    await app.register(apiRoutes);

    // Exposer la doc JSON
    app.get("/api-doc.json", async () => {
        return app.swagger();
    });

    // Gestion des erreurs globale
    app.setErrorHandler((error: any, _request, reply) => {
        app.log.error(error);
        if (error.validation) {
            return reply.status(400).send({
                error: "Validation Error",
                message: error.message,
                details: error.validation
            });
        }
        return reply.status(error.statusCode || 500).send({
            error: error.name || "Internal Server Error",
            message: error.message,
            ...(process.env.NODE_ENV === "development" && { stack: error.stack })
        });
    });

    // On attend swagger avant de retourner l'app
    await app.ready();

    return app;
};