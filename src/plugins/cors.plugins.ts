import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";

const corsPlugin = async (app: FastifyInstance) => {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });
};

export default fp(corsPlugin);
