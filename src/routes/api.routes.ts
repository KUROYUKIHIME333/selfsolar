import { FastifyInstance } from "fastify";
import { installationPhotovoltaiqueRoutes } from "./installationPhotovoltaique.routes.js";

export const apiRoutes = async (app: FastifyInstance) => {
    // Documentation OpenAPI/Swagger
    app.get("/documentation", async (request, reply) => {
        return {
            api: "Dimensionnement Photovoltaïque API",
            version: "2.0.0",
            description: "API de dimensionnement d'installations photovoltaïques conformes normes NFC 15-100, IEC 61215",
            endpoints: {
                "POST /api/v1/pv/dimensionner": "Dimensionnement complet installation PV",
                "GET /api/v1/pv/sante": "État des services",
                "GET /api/v1/pv/normes-reference": "Liste des normes applicables"
            },
            documentation: "/documentation"
        };
    });

    // Routes PV sous préfixe /api/v1/pv
    app.register(installationPhotovoltaiqueRoutes, { prefix: "/api/v1/pv" });
};