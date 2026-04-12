import { buildApp } from "./app.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const start = async () => {
    const app = await buildApp();

    try {
        await app.listen({
            port: PORT,
            host: HOST
        });
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }

    // IDEA: séparer buildApp() de listen() permet d'injecter l'app dans les tests sans ouvrir de socket TCP réel.
    // IDEA: Pattern App Factory

};

start();
