import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const start = async () => {
    // Initialisation de l'instance via la Factory
    const app = await buildApp();

    // Verifier les routes enregistrées avant de démarrer le serveur
    app.ready(() => {
        console.log("Application prète à recevoir des requêtes.");
    });

    try {
        // Démarrage de l'écoute réseau
        await app.listen({
            port: PORT,
            host: HOST
        });

        // Affichage console
        // IDEA: Si HOST est 0.0.0.0, on affiche localhost pour que ce soit cliquable
        const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;

        app.log.info("|====================================================|");
        app.log.info("|                  SelfSolar API Demarree            |");
        app.log.info("|====================================================|");
        app.log.info(`|  API:         http://${displayHost}:${PORT}/api/v1/        |`);
        app.log.info(`|  Swagger UI:  http://${displayHost}:${PORT}/documentation/ |`);
        app.log.info(`|  OpenAPI:     http://${displayHost}:${PORT}/api-spec.json  |`);
        app.log.info("|====================================================|");
        app.log.info("📋 Routes enregistrées:");
        app.log.info(app.printRoutes());
        app.log.info("|====================================================|");

    } catch (error) {
        // Instance app est utilise pour logger l'erreur avant de couper
        if (app) app.log.error(error);
        else console.error(error);

        process.exit(1);
    }
};

// IDEA: Gestion propre des signaux d'arrêt (Optionnel mais recommandé pour Docker)
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
    process.on(signal, async () => {
        console.log(`\nReçu ${signal}, fermeture du serveur...`);
        // IDEA: On pourrait fermer la connexion à la DB (Supabase/PostgreSQL) ici, si on utilise ca
        process.exit(0);
    });
});

start();